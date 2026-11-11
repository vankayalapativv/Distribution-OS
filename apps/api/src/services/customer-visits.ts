import type { SqlClient } from "../lib/db";

/**
 * Check-in / visit history for one customer, for the web customer page's Visits
 * tab. Summary counts (Today / this Week / this Month / All-time) are computed in
 * IST so they match the field team's day; rows are the visits in an optional
 * date range, newest first, paginated.
 */

type Row = Record<string, unknown>;
const iso = (v: unknown): string | null => {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return null;
};
const ymd = (v: unknown): string | null => {
  const s = iso(v);
  return s ? s.slice(0, 10) : null;
};
const n = (v: unknown): number => (v == null ? 0 : Number(v));

/** A navigable reference (order / collection) matched to a visit day. */
export interface VisitRef {
  id: string;
  code: string;
}
const refs = (raw: unknown): VisitRef[] =>
  Array.isArray(raw)
    ? raw.map((x) => ({ id: String((x as VisitRef).id), code: String((x as VisitRef).code) }))
    : [];

export interface VisitRow {
  id: string;
  visitDate: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  /** Time spent (checkout − checkin). Null when auto-closed (no GPS fix) → "—". */
  durationMinutes: number | null;
  /** Free-text reason recorded at a no-order/no-collection checkout. */
  noOutcomeReason: string | null;
  executiveName: string;
  /** The visitor's role code at display time (e.g. SUPER_ADMIN, SALES_EXECUTIVE),
   *  so the web Visits table can badge who checked in. "" when unknown. */
  executiveRole: string;
  type: string;
  // Real records matched to this visit's day (no FK exists): orders share the
  // customer + SE + date; collections share the customer + date.
  orders: VisitRef[];
  collections: VisitRef[];
  // Count of market-intelligence field photos captured for this customer that day.
  marketIntelCount: number;
}

/** All-time visit stats for one visitor role (executive or super-admin). */
export interface VisitRoleStat {
  /** Total real check-ins all-time. */
  total: number;
  /** Check-ins that produced an order or collection (productivity numerator). */
  productive: number;
  /** Average recorded duration (minutes), null when none has a duration. */
  avgDurationMinutes: number | null;
}

export interface CustomerVisits {
  summary: { today: number; week: number; month: number; all: number };
  rows: VisitRow[];
  total: number;
  /** Visits in the SAME range that produced an order or a collection — the
   *  numerator for the customer's "Productivity %" pill (denominator is `total`). */
  productive: number;
  /** Average time-spent (minutes) over the range, excluding auto-closed visits;
   *  null when no visit in range has a recorded duration. */
  avgDurationMinutes: number | null;
  /** ALL-TIME avg-time-spent + productivity split by the visitor's role — feeds
   *  the Visits tab's "Avg time" and "Productivity" chips as "Exec … · Admin …".
   *  `admin` counts SUPER_ADMIN visits; `executive` counts everyone else (SE). */
  byRole: {
    executive: VisitRoleStat;
    admin: VisitRoleStat;
  };
  page: number;
  pageSize: number;
  /** Planned beat stops for this customer that were MISSED (never checked in)
   *  within the window — rendered as rows in the Visits table, NOT counted as
   *  visits (the tiles/total stay real check-ins). Each carries its 8 PM IST
   *  instant (`at`) so the row sorts into date sequence, and `newer` = how many
   *  real check-ins are newer than it, so the client places it on the right
   *  page at the right spot without counting it in pagination. */
  missedRows: { date: string | null; at: string | null; executiveName: string; newer: number }[];
}

function mapVisit(r: Row): VisitRow {
  return {
    id: String(r.id),
    visitDate: ymd(r.visitDate),
    checkInTime: iso(r.checkInTime),
    checkOutTime: iso(r.checkOutTime),
    durationMinutes: r.durationMinutes == null ? null : Number(r.durationMinutes),
    noOutcomeReason: typeof r.noOutcomeReason === "string" ? r.noOutcomeReason : null,
    executiveName: typeof r.executiveName === "string" ? r.executiveName : "Unknown",
    executiveRole: typeof r.executiveRole === "string" ? r.executiveRole : "",
    type: r.type === "planned" ? "planned" : "unplanned",
    orders: refs(r.orders),
    collections: refs(r.collections),
    marketIntelCount: n(r.marketIntelCount),
  };
}

export async function getCustomerVisits(
  sql: SqlClient,
  customerId: string,
  from: string | null,
  to: string | null,
  page: number,
  pageSize: number,
): Promise<CustomerVisits> {
  const p = Math.max(1, page || 1);
  const size = Math.min(50, Math.max(1, pageSize || 8));
  const offset = (p - 1) * size;

  const [sum] = (await sql`
    /* customer_visits_summary */
    select
      count(*) filter (where visit_date = (now() at time zone 'Asia/Kolkata')::date) as today,
      count(*) filter (where visit_date >= date_trunc('week', now() at time zone 'Asia/Kolkata')::date) as week,
      count(*) filter (where visit_date >= date_trunc('month', now() at time zone 'Asia/Kolkata')::date) as month,
      count(*) as all
    from visits where customer_id = ${customerId}::uuid
  `) as Row[];

  const [cnt] = (await sql`
    /* customer_visits_count */
    select
      count(*)::int as total,
      -- Avg time-spent over the range, excluding auto-closed (NULL duration) visits.
      round(avg(v.visit_duration_minutes) filter (where v.visit_duration_minutes is not null))::int as "avgDuration",
      count(*) filter (where
        exists (
          select 1 from orders o
          where o.customer_id = v.customer_id and o.sales_executive_id = v.executive_id
            and o.order_date = v.visit_date
        )
        or exists (
          select 1 from collections cl
          where cl.customer_id = v.customer_id and cl.collection_date = v.visit_date
        )
      )::int as productive
    from visits v
    where v.customer_id = ${customerId}::uuid
      and (${from}::date is null or v.visit_date >= ${from}::date)
      and (${to}::date is null or v.visit_date <= ${to}::date)
  `) as Row[];

  const rows = (await sql`
    /* customer_visits_rows */
    select v.id, v.visit_date as "visitDate", v.check_in_time as "checkInTime",
      v.check_out_time as "checkOutTime", v.visit_duration_minutes as "durationMinutes",
      v.no_outcome_reason as "noOutcomeReason",
      coalesce(u.name, 'Unknown') as "executiveName",
      (select r.code from user_roles ur join roles r on r.id = ur.role_id
        where ur.user_id = v.executive_id
        order by case r.code when 'SUPER_ADMIN' then 0 when 'SALES_EXECUTIVE' then 1 else 2 end
        limit 1) as "executiveRole",
      v.planned_or_unplanned as "type",
      coalesce((
        select json_agg(json_build_object('id', o.id, 'code', o.order_code) order by o.created_at)
        from orders o
        where o.customer_id = v.customer_id and o.sales_executive_id = v.executive_id
          and o.order_date = v.visit_date
      ), '[]') as "orders",
      coalesce((
        select json_agg(json_build_object('id', cl.id, 'code', cl.collection_code) order by cl.created_at)
        from collections cl
        where cl.customer_id = v.customer_id and cl.collection_date = v.visit_date
      ), '[]') as "collections",
      coalesce((
        select count(*) from customer_photos p
        where p.customer_id = v.customer_id and p.category = 'market_intelligence'
          and (p.created_at at time zone 'Asia/Kolkata')::date = v.visit_date
      ), 0) as "marketIntelCount"
    from visits v
    left join users u on u.id = v.executive_id
    where v.customer_id = ${customerId}::uuid
      and (${from}::date is null or v.visit_date >= ${from}::date)
      and (${to}::date is null or v.visit_date <= ${to}::date)
    order by coalesce(v.check_in_time, v.visit_date::timestamptz) desc
    limit ${size} offset ${offset}
  `) as Row[];

  // Beat stops this customer MISSED (planned, never checked in) within the window:
  // 'missed' once the 8 PM cron flips it, or still 'pending' past today's 8 PM
  // cutoff. Surfaced as extra rows in the Visits table (with the beat's SE), NOT
  // counted as visits. One row per missed beat day, newest first.
  const missed = (await sql`
    /* customer_missed_beat_rows */
    select
      bp.plan_date as "date",
      -- The instant a missed beat is settled: 8 PM IST on the plan day. Used both
      -- to show "8:00 PM" and to sort the row into the newest-first sequence.
      ((bp.plan_date::timestamp + interval '20 hours') at time zone 'Asia/Kolkata') as "at",
      coalesce(u.name, 'Unknown') as "executiveName",
      -- How many real check-ins (same range) are newer than this missed instant,
      -- so the client can drop it onto the right page without counting it.
      (
        select count(*)::int from visits v2
        where v2.customer_id = ${customerId}::uuid
          and (${from}::date is null or v2.visit_date >= ${from}::date)
          and (${to}::date is null or v2.visit_date <= ${to}::date)
          and coalesce(v2.check_in_time, v2.visit_date::timestamptz)
              > ((bp.plan_date::timestamp + interval '20 hours') at time zone 'Asia/Kolkata')
      ) as "newer"
    from beat_plan_stops bps
    join beat_plans bp on bp.id = bps.beat_plan_id
    left join users u on u.id = bp.executive_id
    where bps.customer_id = ${customerId}::uuid
      and (${from}::date is null or bp.plan_date >= ${from}::date)
      and (${to}::date is null or bp.plan_date <= ${to}::date)
      and (
        bps.stop_status = 'missed'
        or (bps.stop_status = 'pending' and bp.plan_date = (now() at time zone 'Asia/Kolkata')::date
            and extract(hour from (now() at time zone 'Asia/Kolkata')) >= 20)
      )
    order by bp.plan_date desc
    limit 50
  `) as Row[];

  // ALL-TIME avg-time + productivity split by the visitor's role (SUPER_ADMIN →
  // "admin", everyone else → "executive"). Deliberately NOT range-scoped — the
  // chips always reflect the customer's full history.
  const byRoleRows = (await sql`
    /* customer_visits_by_role */
    select
      case when exists (
        select 1 from user_roles ur join roles r on r.id = ur.role_id
        where ur.user_id = v.executive_id and r.code = 'SUPER_ADMIN'
      ) then 'admin' else 'executive' end as "bucket",
      count(*)::int as "total",
      round(avg(v.visit_duration_minutes) filter (where v.visit_duration_minutes is not null))::int as "avgDuration",
      count(*) filter (where
        exists (
          select 1 from orders o
          where o.customer_id = v.customer_id and o.sales_executive_id = v.executive_id
            and o.order_date = v.visit_date
        )
        or exists (
          select 1 from collections cl
          where cl.customer_id = v.customer_id and cl.collection_date = v.visit_date
        )
      )::int as "productive"
    from visits v
    where v.customer_id = ${customerId}::uuid
    group by "bucket"
  `) as Row[];
  const roleStat = (bucket: string): VisitRoleStat => {
    const r = byRoleRows.find((x) => x.bucket === bucket);
    return {
      total: n(r?.total),
      productive: n(r?.productive),
      avgDurationMinutes: r?.avgDuration == null ? null : Number(r.avgDuration),
    };
  };

  return {
    summary: { today: n(sum?.today), week: n(sum?.week), month: n(sum?.month), all: n(sum?.all) },
    rows: rows.map(mapVisit),
    total: n(cnt?.total),
    productive: n(cnt?.productive),
    avgDurationMinutes: cnt?.avgDuration == null ? null : Number(cnt.avgDuration),
    byRole: { executive: roleStat("executive"), admin: roleStat("admin") },
    page: p,
    pageSize: size,
    missedRows: missed.map((r) => ({
      date: ymd(r.date),
      at: iso(r.at),
      executiveName: typeof r.executiveName === "string" ? r.executiveName : "Unknown",
      newer: n(r.newer),
    })),
  };
}
