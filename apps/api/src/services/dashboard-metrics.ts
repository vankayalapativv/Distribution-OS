/**
 * Live dashboard metrics for SUPER_ADMIN / MANAGER (2026-07-18).
 *
 * Unlike the legacy dashboard (which read `daily_executive_performance`, a
 * table only the dormant executive-day flow writes), every number here is
 * computed on request from the base tables the mobile app actually fills:
 * visits, orders + order_items, collections, customer_photos and
 * gps_tracking_sessions.
 *
 * Period: inclusive [from, to] calendar dates (IST business dates — visits,
 * orders and collections all store date columns already derived from IST).
 *
 * Definitions (decided 2026-07-18):
 * - Active executive: has a GPS session today AND last ping < 12 min ago.
 * - Productive visit: on the visit's date, the same executive + customer has
 *   an order, a collection, or a market-intelligence photo upload.
 * - Collections: all statuses count toward the total; verified shown apart.
 */
import { ApiError } from "../lib/errors";
import type { SqlClient } from "../lib/db";

interface MetricsContext {
  userId: string;
}

export interface MetricsRange {
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD inclusive
}

type Row = Record<string, unknown>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function assertValidRange(range: MetricsRange): void {
  if (!DATE_RE.test(range.from) || !DATE_RE.test(range.to)) {
    throw new ApiError("INVALID_FIELD", "from/to must be YYYY-MM-DD dates.", 422);
  }
  if (range.from > range.to) {
    throw new ApiError("INVALID_FIELD", "from must not be after to.", 422);
  }
}

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  return 0;
}

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
}

function nullStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return str(v) || null;
}


export async function getDashboardMetrics(
  sql: SqlClient,
  context: MetricsContext,
  range: MetricsRange,
) {
  assertValidRange(range);

  // These six reads are independent, so fire them as one parallel batch instead
  // of six sequential Neon round-trips (each ~50ms over HTTP). Wall time drops
  // from the sum to roughly the slowest single query.
  const [[executives], [visits], [ordered], [delivered], oilBrandRows, [collections]] =
    await Promise.all([
      sql`
    /* metrics_executives */
    select
      count(*)::int as "total",
      count(*) filter (
        where exists (
          select 1
          from gps_tracking_sessions s
          join gps_points p on p.session_id = s.id
          where s.user_id = u.id
            and s.session_date = (now() at time zone 'Asia/Kolkata')::date
          group by s.id
          having max(p.recorded_at) > now() - interval '12 minutes'
        )
      )::int as "live"
    from users u
    join user_roles ur on ur.user_id = u.id
    join roles r on r.id = ur.role_id and r.code = 'SALES_EXECUTIVE'
    where u.status = 'active'
  `,
      sql`
    /* metrics_visits */
    select
      count(*)::int as "visits",
      count(*) filter (where exists (
        select 1 from orders po
        where po.customer_id = v.customer_id
          and po.sales_executive_id = v.executive_id
          and po.order_date = v.visit_date
      )
      or exists (
        select 1 from collections pc
        where pc.customer_id = v.customer_id
          and pc.collected_by_user_id = v.executive_id
          and pc.collection_date = v.visit_date
      )
      or exists (
        select 1 from customer_photos pp
        where pp.customer_id = v.customer_id
          and pp.uploaded_by = v.executive_id
          and pp.category = 'market_intelligence'
          and (pp.created_at at time zone 'Asia/Kolkata')::date = v.visit_date
      ))::int as "productiveVisits"
    from visits v
    where v.visit_date between ${range.from}::date and ${range.to}::date
  `,
      // GROSS ordered oils = every oil order line's ORIGINAL litres (raw demand),
  // INCLUDING cancelled orders and BEFORE subtracting returns — deliberately
  // different from `salesLitres` (Sold Oil) above, which is net of returns and
  // excludes cancelled. `+ cancelled_units` adds back the short-closed remainder
  // (short-close shrinks quantity_units to the invoiced amount) so this stays the
  // ORIGINAL ordered demand, unaffected by short-closing.
      sql`
    /* metrics_ordered */
    select
      coalesce(sum((oi.quantity_units + coalesce(oi.cancelled_units, 0)) * oi.pack_size_litres) filter (where oi.product_id is not null), 0)::numeric as "litres",
      count(distinct o.id)::int as "orders"
    from orders o
    left join order_items oi on oi.order_id = o.id
    where o.order_date between ${range.from}::date and ${range.to}::date
  `,
      // SOLD OIL = DELIVERED oil litres, NET of oil returns ("what stayed with the
  // customer"). "Delivered" = a non-rejected invoice that is on a delivery-run
  // stop (the fulfillment ladder's delivered signal, migration 0074). Scoped by
  // invoice_date (delivery/billing date). Its own truth — distinct from ordered
  // (metrics_ordered).
      sql`
    /* metrics_delivered */
    select
      coalesce(sum(i.total_litres - coalesce(r.rl, 0)), 0)::numeric as "litres",
      count(*)::int as "deliveries"
    from invoices i
    left join (
      select sr.invoice_id, sum(sri.litres) as rl
      from sales_returns sr
      join sales_return_items sri on sri.sales_return_id = sr.id and sri.kind = 'oil'
      group by sr.invoice_id
    ) r on r.invoice_id = i.id
    where i.approval_status <> 'rejected' and i.doc_status <> 'cancelled'
      and exists (select 1 from delivery_run_stops ds where ds.invoice_id = i.id)
      and i.invoice_date between ${range.from}::date and ${range.to}::date
  `,
      // Per-brand ordered oil (litres NET of returns, non-cancelled) — brand lives
  // cleanly on order_items → products.brand, so this is exact. Only brands with
  // positive litres appear (dynamic), biggest first.
      sql`
    /* metrics_oils_by_brand */
    select
      coalesce(nullif(btrim(p.brand), ''), 'Unbranded') as "brand",
      coalesce(sum((oi.quantity_units * oi.pack_size_litres) - coalesce(ret.rlitres, 0)), 0)::numeric as "litres",
      count(distinct o.id)::int as "orders"
    from order_items oi
    join orders o on o.id = oi.order_id
    join products p on p.id = oi.product_id
    left join (
      select order_item_id, sum(litres) as rlitres
      from sales_return_items where kind = 'oil' group by order_item_id
    ) ret on ret.order_item_id = oi.id
    where oi.product_id is not null
      and o.order_status <> 'cancelled'
      and o.order_date between ${range.from}::date and ${range.to}::date
    group by coalesce(nullif(btrim(p.brand), ''), 'Unbranded')
    having coalesce(sum((oi.quantity_units * oi.pack_size_litres) - coalesce(ret.rlitres, 0)), 0) > 0
    order by "litres" desc
  `,
      sql`
    /* metrics_collections */
    select
      coalesce(sum(collection_amount), 0)::numeric as "total",
      coalesce(sum(collection_amount) filter (where accountant_approval_status = 'verified'), 0)::numeric as "verified",
      count(*) filter (where accountant_approval_status = 'pending' or accountant_approval_status is null)::int as "pendingCount",
      count(*)::int as "count"
    from collections
    where collection_date between ${range.from}::date and ${range.to}::date
      -- Credit notes are a dues ADJUSTMENT, not cash collected (they live in
      -- collections as payment_mode=credit_note) — exclude from money + counts.
      and payment_mode <> 'credit_note'
  `,
    ]);

  return {
    range,
    activeExecutives: { live: num(executives?.live), total: num(executives?.total) },
    visits: num(visits?.visits),
    productiveVisits: num(visits?.productiveVisits),
    // Sold Oil is now delivered-based; `orders` carries the delivered-invoice count.
    sales: { litres: num(delivered?.litres), orders: num(delivered?.deliveries) },
    orderedOils: { litres: num(ordered?.litres), orders: num(ordered?.orders) },
    oilsByBrand: (oilBrandRows as Row[]).map((r) => ({
      brand: str(r.brand),
      litres: num(r.litres),
      orders: num(r.orders),
    })),
    collections: {
      total: num(collections?.total),
      verified: num(collections?.verified),
      pendingCount: num(collections?.pendingCount),
      count: num(collections?.count),
    },
  };
}

export const METRICS = [
  "executives",
  "visits",
  "productive",
  "productivity",
  "ordered",
  "litres",
  "collections",
] as const;
export type MetricKey = (typeof METRICS)[number];

export function assertMetric(metric: string): MetricKey {
  if (!(METRICS as readonly string[]).includes(metric)) {
    throw new ApiError("INVALID_FIELD", `Unknown metric "${metric}".`, 422);
  }
  return metric as MetricKey;
}

/** Level 1 — per-agent rows for one metric. */
export async function getMetricAgents(
  sql: SqlClient,
  context: MetricsContext,
  metric: MetricKey,
  range: MetricsRange,
) {
  assertValidRange(range);

  if (metric === "executives") {
    const rows = await sql`
      /* agents_executives */
      select
        u.id as "agentId",
        u.name as "agentName",
        s.started_at as "sessionStartedAt",
        lp.last_ping as "lastPingAt",
        (lp.last_ping > now() - interval '12 minutes') as "live",
        coalesce(vc.visits, 0)::int as "visits"
      from users u
      join user_roles ur on ur.user_id = u.id
      join roles r on r.id = ur.role_id and r.code = 'SALES_EXECUTIVE'
      left join gps_tracking_sessions s
        on s.user_id = u.id and s.session_date = (now() at time zone 'Asia/Kolkata')::date
      left join lateral (
        select max(p.recorded_at) as last_ping
        from gps_points p
        where p.user_id = u.id
      ) lp on true
      left join lateral (
        select count(*)::int as visits
        from visits v
        where v.executive_id = u.id
          and v.visit_date between ${range.from}::date and ${range.to}::date
      ) vc on true
      where u.status = 'active'
      order by (s.id is not null) desc, u.name
    `;
    return rows.map((r: Row) => ({
      agentId: str(r.agentId),
      agentName: str(r.agentName),
      sessionStartedAt: nullStr(r.sessionStartedAt),
      lastPingAt: nullStr(r.lastPingAt),
      live: Boolean(r.live),
      visits: num(r.visits),
    }));
  }

  if (metric === "visits" || metric === "productive" || metric === "productivity") {
    const rows = await sql`
      /* agents_visits */
      select
        u.id as "agentId",
        u.name as "agentName",
        count(*)::int as "visits",
        count(*) filter (where exists (
        select 1 from orders po
        where po.customer_id = v.customer_id
          and po.sales_executive_id = v.executive_id
          and po.order_date = v.visit_date
      )
      or exists (
        select 1 from collections pc
        where pc.customer_id = v.customer_id
          and pc.collected_by_user_id = v.executive_id
          and pc.collection_date = v.visit_date
      )
      or exists (
        select 1 from customer_photos pp
        where pp.customer_id = v.customer_id
          and pp.uploaded_by = v.executive_id
          and pp.category = 'market_intelligence'
          and (pp.created_at at time zone 'Asia/Kolkata')::date = v.visit_date
      ))::int as "productiveVisits",
        count(distinct v.customer_id)::int as "customers",
        -- Avg time-spent per SE over the range (manual checkouts only; NULL dur excluded).
        round(avg(v.visit_duration_minutes) filter (where v.visit_duration_minutes is not null))::int as "avgDuration"
      from visits v
      join users u on u.id = v.executive_id
      where v.visit_date between ${range.from}::date and ${range.to}::date
      group by u.id, u.name
      order by count(*) desc
    `;
    return rows
      .map((r: Row) => ({
        agentId: str(r.agentId),
        agentName: str(r.agentName),
        visits: num(r.visits),
        productiveVisits: num(r.productiveVisits),
        customers: num(r.customers),
        avgDurationMinutes: r.avgDuration == null ? null : num(r.avgDuration),
      }))
      .filter((r) => (metric === "productive" ? r.productiveVisits > 0 : r.visits > 0))
      // Productivity drill-down ranks by productive-visit ratio (needs visits > 0,
      // already ensured above); visits/productive keep the SQL count ordering.
      .sort((a, b) =>
        metric === "productivity"
          ? b.productiveVisits / b.visits - a.productiveVisits / a.visits
          : 0,
      );
  }

  if (metric === "ordered") {
    // GROSS ordered oils per executive — all order statuses, before returns,
    // ORIGINAL quantity (+ cancelled_units adds back the short-closed remainder),
    // matching metrics_ordered so the drill-down sums to the card.
    const rows = await sql`
      /* agents_ordered */
      select
        u.id as "agentId",
        u.name as "agentName",
        coalesce(sum((oi.quantity_units + coalesce(oi.cancelled_units, 0)) * oi.pack_size_litres) filter (where oi.product_id is not null), 0)::numeric as "litres",
        count(distinct o.id)::int as "orders",
        count(distinct o.customer_id)::int as "customers"
      from orders o
      join users u on u.id = o.sales_executive_id
      left join order_items oi on oi.order_id = o.id
      where o.order_date between ${range.from}::date and ${range.to}::date
      group by u.id, u.name
      order by 3 desc
    `;
    return rows
      .map((r: Row) => ({
        agentId: str(r.agentId),
        agentName: str(r.agentName),
        litres: num(r.litres),
        orders: num(r.orders),
        customers: num(r.customers),
      }))
      .filter((r) => r.litres > 0);
  }

  if (metric === "litres") {
    // SOLD OIL per executive — delivered invoice oil litres NET of oil returns,
    // by invoice date, attributed to the invoice's executive (fallback: order's).
    const rows = await sql`
      /* agents_delivered */
      select
        coalesce(i.sales_executive_id, o.sales_executive_id) as "agentId",
        u.name as "agentName",
        coalesce(sum(i.total_litres - coalesce(r.rl, 0)), 0)::numeric as "litres",
        count(*)::int as "orders",
        count(distinct i.customer_id)::int as "customers"
      from invoices i
      join orders o on o.id = i.order_id
      join users u on u.id = coalesce(i.sales_executive_id, o.sales_executive_id)
      left join (
        select sr.invoice_id, sum(sri.litres) as rl
        from sales_returns sr
        join sales_return_items sri on sri.sales_return_id = sr.id and sri.kind = 'oil'
        group by sr.invoice_id
      ) r on r.invoice_id = i.id
      where i.approval_status <> 'rejected' and i.doc_status <> 'cancelled'
        and exists (select 1 from delivery_run_stops ds where ds.invoice_id = i.id)
        and i.invoice_date between ${range.from}::date and ${range.to}::date
      group by coalesce(i.sales_executive_id, o.sales_executive_id), u.name
      order by 3 desc
    `;
    return rows
      .map((r: Row) => ({
        agentId: str(r.agentId),
        agentName: str(r.agentName),
        litres: num(r.litres),
        orders: num(r.orders), // delivered invoices
        customers: num(r.customers),
      }))
      .filter((r) => r.litres > 0)
      .sort((a, b) => b.litres - a.litres);
  }

  // collections
  const rows = await sql`
    /* agents_collections */
    select
      u.id as "agentId",
      u.name as "agentName",
      coalesce(sum(c.collection_amount), 0)::numeric as "amount",
      coalesce(sum(c.collection_amount) filter (where c.accountant_approval_status = 'verified'), 0)::numeric as "verified",
      count(*)::int as "collections",
      count(distinct c.customer_id)::int as "customers"
    from collections c
    join users u on u.id = c.collected_by_user_id
    where c.collection_date between ${range.from}::date and ${range.to}::date
      and c.payment_mode <> 'credit_note'  -- credit notes aren't cash collected
    group by u.id, u.name
    order by 3 desc
  `;
  return rows.map((r: Row) => ({
    agentId: str(r.agentId),
    agentName: str(r.agentName),
    amount: num(r.amount),
    verified: num(r.verified),
    collections: num(r.collections),
    customers: num(r.customers),
  }));
}

/** Level 2 — per-customer rows for one agent + metric. */
export async function getMetricAgentCustomers(
  sql: SqlClient,
  context: MetricsContext,
  metric: MetricKey,
  agentId: string,
  range: MetricsRange,
) {
  assertValidRange(range);

  if (metric === "executives") {
    // Day timeline for the SE: one row per tracked day in the range.
    const rows = await sql`
      /* agent_day_timeline */
      select
        s.session_date as "date",
        s.started_at as "startedAt",
        s.ended_at as "endedAt",
        lp.last_ping as "lastPingAt",
        coalesce(vc.visits, 0)::int as "visits"
      from gps_tracking_sessions s
      left join lateral (
        select max(p.recorded_at) as last_ping
        from gps_points p where p.session_id = s.id
      ) lp on true
      left join lateral (
        select count(*)::int as visits
        from visits v
        where v.executive_id = s.user_id and v.visit_date = s.session_date
      ) vc on true
      where s.user_id = ${agentId}::uuid
        and s.session_date between ${range.from}::date and ${range.to}::date
      order by s.session_date desc
    `;
    return rows.map((r: Row) => ({
      date: str(r.date).slice(0, 10),
      startedAt: nullStr(r.startedAt),
      endedAt: nullStr(r.endedAt),
      lastPingAt: nullStr(r.lastPingAt),
      visits: num(r.visits),
    }));
  }

  if (metric === "visits" || metric === "productive" || metric === "productivity") {
    // Per-visit outcomes. Visits carry no FK to the order/collection they
    // produced, so we infer the link by same executive + customer + same date
    // (matches how `productive` is computed). Each visit lists its own orders
    // (oil litres net of returns) and collections (₹), each with
    // an id so the web row can deep-link to /orders/:id and /collections/:id.
    const rows = await sql`
      /* agent_customer_visits */
      select
        cu.id as "customerId",
        cu.legal_name as "customerName",
        v.visit_date as "date",
        v.check_in_time as "checkInAt",
        v.check_out_time as "checkOutAt",
        v.planned_or_unplanned as "planned",
        coalesce(og.orders, '[]'::json) as "orders",
        coalesce(cg.collections, '[]'::json) as "collections",
        (og.orders is not null
         or cg.collections is not null
         or exists (
           select 1 from customer_photos pp
           where pp.customer_id = v.customer_id
             and pp.uploaded_by = v.executive_id
             and pp.category = 'market_intelligence'
             and (pp.created_at at time zone 'Asia/Kolkata')::date = v.visit_date
         )) as "productive"
      from visits v
      join customers cu on cu.id = v.customer_id
      left join lateral (
        select json_agg(x order by x.created_at) as orders
        from (
          select
            o.id, o.order_code as code, o.created_at,
            coalesce(sum((oi.quantity_units * oi.pack_size_litres) - coalesce(ret.rlitres, 0))
              filter (where oi.product_id is not null), 0)::numeric as litres
          from orders o
          left join order_items oi on oi.order_id = o.id
          left join (
            select order_item_id, sum(litres) as rlitres
            from sales_return_items where kind = 'oil' group by order_item_id
          ) ret on ret.order_item_id = oi.id
          where o.customer_id = v.customer_id
            and o.sales_executive_id = v.executive_id
            and o.order_date = v.visit_date
            and o.order_status <> 'cancelled'
          group by o.id, o.order_code, o.created_at
        ) x
      ) og on true
      left join lateral (
        select json_agg(json_build_object(
          'id', c.id, 'code', c.collection_code, 'amount', c.collection_amount
        ) order by c.created_at) as collections
        from collections c
        where c.customer_id = v.customer_id
          and c.collected_by_user_id = v.executive_id
          and c.collection_date = v.visit_date
      ) cg on true
      where v.executive_id = ${agentId}::uuid
        and v.visit_date between ${range.from}::date and ${range.to}::date
      order by v.check_in_time desc
    `;
    return rows
      .map((r: Row) => ({
        customerId: str(r.customerId),
        customerName: str(r.customerName),
        date: str(r.date).slice(0, 10),
        checkInAt: nullStr(r.checkInAt),
        checkOutAt: nullStr(r.checkOutAt),
        planned: str(r.planned),
        orders: Array.isArray(r.orders)
          ? (r.orders as Row[]).map((o) => ({
              id: str(o.id),
              code: str(o.code),
              litres: num(o.litres),
            }))
          : [],
        collections: Array.isArray(r.collections)
          ? (r.collections as Row[]).map((c) => ({
              id: str(c.id),
              code: str(c.code),
              amount: num(c.amount),
            }))
          : [],
        productive: Boolean(r.productive),
      }))
      .filter((r) => (metric === "productive" ? r.productive : true));
  }

  if (metric === "ordered") {
    // GROSS ordered oils per order (all statuses, before returns), newest first.
    const rows = await sql`
      /* agent_customer_ordered */
      select
        cu.id as "customerId",
        cu.legal_name as "customerName",
        o.order_code as "orderCode",
        o.order_date as "date",
        o.created_at as "createdAt",
        o.order_status as "orderStatus",
        coalesce(sum(oi.quantity_units * oi.pack_size_litres) filter (where oi.product_id is not null), 0)::numeric as "litres",
        count(*) filter (where oi.product_id is not null)::int as "oilLines"
      from orders o
      join customers cu on cu.id = o.customer_id
      left join order_items oi on oi.order_id = o.id
      where o.sales_executive_id = ${agentId}::uuid
        and o.order_date between ${range.from}::date and ${range.to}::date
      group by cu.id, cu.legal_name, o.id, o.order_code, o.order_date, o.created_at, o.order_status
      order by o.created_at desc
    `;
    return rows
      .map((r: Row) => ({
        customerId: str(r.customerId),
        customerName: str(r.customerName),
        orderCode: str(r.orderCode),
        date: str(r.date).slice(0, 10),
        createdAt: str(r.createdAt),
        orderStatus: str(r.orderStatus),
        litres: num(r.litres),
        oilLines: num(r.oilLines),
      }))
      .filter((r) => r.litres > 0);
  }

  if (metric === "litres") {
    // SOLD OIL detail — one row per DELIVERED invoice for this executive, oil
    // litres net of that invoice's oil returns, newest delivery first.
    const rows = await sql`
      /* agent_customer_delivered */
      select
        cu.id as "customerId",
        cu.legal_name as "customerName",
        i.invoice_number as "orderCode",
        i.invoice_date as "date",
        i.created_at as "createdAt",
        coalesce(r.rl, 0)::numeric as "returnedLitres",
        (i.total_litres - coalesce(r.rl, 0))::numeric as "litres"
      from invoices i
      join orders o on o.id = i.order_id
      join customers cu on cu.id = i.customer_id
      left join (
        select sr.invoice_id, sum(sri.litres) as rl
        from sales_returns sr
        join sales_return_items sri on sri.sales_return_id = sr.id and sri.kind = 'oil'
        group by sr.invoice_id
      ) r on r.invoice_id = i.id
      where coalesce(i.sales_executive_id, o.sales_executive_id) = ${agentId}::uuid
        and i.approval_status <> 'rejected' and i.doc_status <> 'cancelled'
        and exists (select 1 from delivery_run_stops ds where ds.invoice_id = i.id)
        and i.invoice_date between ${range.from}::date and ${range.to}::date
      order by i.invoice_date desc, i.created_at desc
    `;
    return rows.map((r: Row) => ({
      customerId: str(r.customerId),
      customerName: str(r.customerName),
      orderCode: str(r.orderCode), // invoice number
      date: str(r.date).slice(0, 10),
      createdAt: str(r.createdAt),
      litres: num(r.litres),
      returnedLitres: num(r.returnedLitres),
      oilLines: 0,
    }));
  }

  // collections
  const rows = await sql`
    /* agent_customer_collections */
    select
      cu.id as "customerId",
      cu.legal_name as "customerName",
      c.collection_code as "collectionCode",
      c.collection_date as "date",
      c.created_at as "createdAt",
      c.collection_amount as "amount",
      c.payment_mode as "paymentMode",
      c.accountant_approval_status as "status"
    from collections c
    join customers cu on cu.id = c.customer_id
    where c.collected_by_user_id = ${agentId}::uuid
      and c.collection_date between ${range.from}::date and ${range.to}::date
      and c.payment_mode <> 'credit_note'  -- match the agent card (cash collected only)
    order by c.created_at desc
  `;
  return rows.map((r: Row) => ({
    customerId: str(r.customerId),
    customerName: str(r.customerName),
    collectionCode: str(r.collectionCode),
    date: str(r.date).slice(0, 10),
    createdAt: str(r.createdAt),
    amount: num(r.amount),
    paymentMode: str(r.paymentMode),
    status: nullStr(r.status) ?? "pending",
  }));
}
