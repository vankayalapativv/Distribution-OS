/**
 * Product & Customer analytics for the SUPER_ADMIN / MANAGER dashboard
 * (2026-07-20). Same live-from-base-tables approach as dashboard-metrics.ts.
 *
 * Decisions (from the user):
 * - Oils roll up by the ORDER-LINE segment (what the SE actually picked),
 *   and an oil SKU is product + pack size — one product genuinely sells in
 *   several packs (Titan Formula 5W-30 SP ships in 5 of them).
 * - Customers: only those with activity in the period by default; the
 *   `includeInactive` flag adds the rest (216 customers, ~210 dormant).
 * - NO dues/outstanding: invoices don't exist yet and orders carry no price,
 *   so any ₹ owed figure would be fabricated. Only real money is shown —
 *   collected, and how many collections await verification.
 */
import type { SqlClient } from "../lib/db";
import { assertValidRange, type MetricsRange } from "./dashboard-metrics";

interface AnalyticsContext {
  userId: string;
}

type Row = Record<string, unknown>;

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

/** Canonical segment order; segments with no sales still appear (as zeros). */
export const OIL_SEGMENTS = [
  "Car",
  "2W",
  "3W",
  "Commercial",
  "Agri",
  "Gear Oil",
  "Coolant",
  "Grease",
] as const;

export interface OilSku {
  productId: string;
  productName: string;
  packSizeLitres: number;
  litres: number;
  quantity: number;
  orders: number;
  customers: number;
}

export interface OilSegment {
  segment: string;
  litres: number;
  quantity: number;
  orders: number;
  customers: number;
  skus: OilSku[];
}

/** Oils grouped by order-line segment, each with its product+pack SKUs. */
export async function getOilAnalytics(
  sql: SqlClient,
  context: AnalyticsContext,
  range: MetricsRange,
): Promise<{ segments: OilSegment[]; totalLitres: number }> {
  assertValidRange(range);

  const rows = await sql`
    /* analytics_oils */
    select
      oi.segment,
      oi.product_id as "productId",
      p.product_name as "productName",
      oi.pack_size_litres as "packSizeLitres",
      sum((oi.quantity_units * oi.pack_size_litres) - coalesce(ret.rlitres, 0))::numeric as litres,
      sum(oi.quantity_units)::numeric as quantity,
      count(distinct o.id)::int as orders,
      count(distinct o.customer_id)::int as customers
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
    group by oi.segment, oi.product_id, p.product_name, oi.pack_size_litres
    order by litres desc
  `;

  const bySegment = new Map<string, OilSku[]>();
  for (const r of rows as Row[]) {
    const key = nullStr(r.segment) ?? "Unspecified";
    const list = bySegment.get(key) ?? [];
    list.push({
      productId: str(r.productId),
      productName: str(r.productName),
      packSizeLitres: num(r.packSizeLitres),
      litres: num(r.litres),
      quantity: num(r.quantity),
      orders: num(r.orders),
      customers: num(r.customers),
    });
    bySegment.set(key, list);
  }

  // Segment-level totals need their own roll-up: orders/customers must be
  // distinct across the segment, not the sum of per-SKU counts.
  const segmentTotals = await sql`
    /* analytics_oil_segment_totals */
    select
      oi.segment,
      sum((oi.quantity_units * oi.pack_size_litres) - coalesce(ret.rlitres, 0))::numeric as litres,
      sum(oi.quantity_units)::numeric as quantity,
      count(distinct o.id)::int as orders,
      count(distinct o.customer_id)::int as customers
    from order_items oi
    join orders o on o.id = oi.order_id
    left join (
      select order_item_id, sum(litres) as rlitres
      from sales_return_items where kind = 'oil' group by order_item_id
    ) ret on ret.order_item_id = oi.id
    where oi.product_id is not null
      and o.order_status <> 'cancelled'
      and o.order_date between ${range.from}::date and ${range.to}::date
    group by oi.segment
  `;
  const totalsBySegment = new Map<string, Row>();
  for (const r of segmentTotals as Row[]) {
    totalsBySegment.set(nullStr(r.segment) ?? "Unspecified", r);
  }

  // Every canonical segment appears, plus any unexpected value found in data.
  const names = [
    ...OIL_SEGMENTS,
    ...[...bySegment.keys()].filter(
      (s) => !(OIL_SEGMENTS as readonly string[]).includes(s),
    ),
  ];

  const segments: OilSegment[] = names
    .map((segment) => {
      const t = totalsBySegment.get(segment);
      return {
        segment,
        litres: num(t?.litres),
        quantity: num(t?.quantity),
        orders: num(t?.orders),
        customers: num(t?.customers),
        skus: bySegment.get(segment) ?? [],
      };
    })
    .sort((a, b) => b.litres - a.litres);

  const totalLitres = segments.reduce((s, x) => s + x.litres, 0);
  return { segments, totalLitres };
}

export interface CustomerAnalyticsRow {
  customerId: string;
  customerName: string;
  customerCode: string | null;
  /** The SE who created (owns) this customer; null for bulk-imported rows. */
  salesExecutive: string | null;
  litres: number;
  orders: number;
  collected: number;
  pendingCollections: number;
  lastOrderDate: string | null;
}

/**
 * One row per customer. Active-only by default (216 customers exist but only
 * a handful transact in a given period); `includeInactive` returns the rest
 * so "who orders least / not at all" is still reachable.
 */
export async function getCustomerAnalytics(
  sql: SqlClient,
  context: AnalyticsContext,
  range: MetricsRange,
  options: { includeInactive?: boolean } = {},
): Promise<{ customers: CustomerAnalyticsRow[]; activeCount: number; totalCount: number }> {
  assertValidRange(range);

  const rows = await sql`
    /* analytics_customers */
    select
      c.id as "customerId",
      c.legal_name as "customerName",
      c.customer_code as "customerCode",
      u.name as "salesExecutive",
      coalesce(ol.litres, 0)::numeric as litres,
      coalesce(ol.orders, 0)::int as orders,
      coalesce(cl.collected, 0)::numeric as collected,
      coalesce(cl.pending, 0)::int as "pendingCollections",
      ol.last_order as "lastOrderDate"
    from customers c
    left join users u on u.id = c.created_by
    left join lateral (
      select
        sum((oi.quantity_units * oi.pack_size_litres) - coalesce(ret.rlitres, 0)) filter (where oi.product_id is not null) as litres,
        count(distinct o.id) as orders,
        max(o.order_date) as last_order
      from orders o
      left join order_items oi on oi.order_id = o.id
      left join (
        select order_item_id, sum(litres) as rlitres
        from sales_return_items where kind = 'oil' group by order_item_id
      ) ret on ret.order_item_id = oi.id
      where o.customer_id = c.id
        and o.order_status <> 'cancelled'
        and o.order_date between ${range.from}::date and ${range.to}::date
    ) ol on true
    left join lateral (
      select
        sum(collection_amount) as collected,
        count(*) filter (
          where accountant_approval_status = 'pending' or accountant_approval_status is null
        ) as pending
      from collections
      where customer_id = c.id
        and collection_date between ${range.from}::date and ${range.to}::date
    ) cl on true
    order by coalesce(ol.litres, 0) desc, c.legal_name
  `;

  const all: CustomerAnalyticsRow[] = (rows as Row[]).map((r) => ({
    customerId: str(r.customerId),
    customerName: str(r.customerName),
    customerCode: nullStr(r.customerCode),
    salesExecutive: nullStr(r.salesExecutive),
    litres: num(r.litres),
    orders: num(r.orders),
    collected: num(r.collected),
    pendingCollections: num(r.pendingCollections),
    lastOrderDate: r.lastOrderDate ? str(r.lastOrderDate).slice(0, 10) : null,
  }));

  const isActive = (c: CustomerAnalyticsRow) => c.orders > 0 || c.collected > 0;
  const activeCount = all.filter(isActive).length;

  return {
    customers: options.includeInactive ? all : all.filter(isActive),
    activeCount,
    totalCount: all.length,
  };
}
