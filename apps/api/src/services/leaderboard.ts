import type { SqlClient } from "../lib/db";
import { OIL_SEGMENTS, type OilSegment } from "./targets";

type Row = Record<string, unknown>;

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
}
function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Every active Sales Executive's TOTAL oil litres for today / current week /
 * current month (IST; week starts Monday; net of oil returns; cancelled orders
 * excluded) — the same litre definition as the Home "My performance" card, but
 * summed across all segments per SE. The client ranks per selected period.
 */
export async function oilLeaderboard(sql: SqlClient) {
  const rows = (await sql`
    /* leaderboard_oil_litres */
    with bounds as (
      select
        (now() at time zone 'Asia/Kolkata')::date as today,
        date_trunc('week',  (now() at time zone 'Asia/Kolkata')::date)::date as wstart,
        date_trunc('month', (now() at time zone 'Asia/Kolkata')::date)::date as mstart
    )
    select
      u.id as "userId",
      u.name as "name",
      coalesce(sum(oi.total_litres - coalesce(ret.rlitres, 0)) filter (where o.order_date = b.today), 0)::numeric   as "today",
      coalesce(sum(oi.total_litres - coalesce(ret.rlitres, 0)) filter (where o.order_date >= b.wstart), 0)::numeric as "week",
      coalesce(sum(oi.total_litres - coalesce(ret.rlitres, 0)) filter (where o.order_date >= b.mstart), 0)::numeric as "month"
    from users u
    join user_roles ur on ur.user_id = u.id
    join roles r on r.id = ur.role_id and r.code = 'SALES_EXECUTIVE'
    cross join bounds b
    left join orders o
      on o.sales_executive_id = u.id
      and o.order_date between least(b.wstart, b.mstart) and b.today
      and o.order_status <> 'cancelled'
    left join order_items oi on oi.order_id = o.id and oi.product_id is not null
    left join (
      select order_item_id, coalesce(sum(litres), 0) as rlitres
      from sales_return_items
      where kind = 'oil'
      group by order_item_id
    ) ret on ret.order_item_id = oi.id
    where u.status = 'active'
    group by u.id, u.name
  `) as Row[];
  return rows.map((r) => ({
    userId: str(r.userId),
    name: str(r.name),
    today: num(r.today),
    week: num(r.week),
    month: num(r.month),
  }));
}

/** One SE's litres per oil segment, for a single period. */
export type SegmentLitres = Record<OilSegment, number>;
export interface SegmentSalesRow {
  userId: string;
  name: string;
  today: SegmentLitres;
  week: SegmentLitres;
  month: SegmentLitres;
}

const zeroSegments = (): SegmentLitres =>
  Object.fromEntries(OIL_SEGMENTS.map((s) => [s, 0])) as SegmentLitres;

/**
 * Every active SE's oil litres broken down BY SEGMENT for today / current week /
 * current month — same litre definition as {@link oilLeaderboard} (IST; net of
 * oil returns; cancelled orders excluded), but grouped by `order_items.segment`
 * so the Home "Sales by segment" card can show each SE's per-segment split. The
 * client ranks SEs by their period total and drops zero-sale SEs.
 */
export async function oilSegmentLeaderboard(sql: SqlClient): Promise<SegmentSalesRow[]> {
  const rows = (await sql`
    /* leaderboard_oil_segments */
    with bounds as (
      select
        (now() at time zone 'Asia/Kolkata')::date as today,
        date_trunc('week',  (now() at time zone 'Asia/Kolkata')::date)::date as wstart,
        date_trunc('month', (now() at time zone 'Asia/Kolkata')::date)::date as mstart
    )
    select
      u.id as "userId",
      u.name as "name",
      oi.segment as "segment",
      coalesce(sum(oi.total_litres - coalesce(ret.rlitres, 0)) filter (where o.order_date = b.today), 0)::numeric   as "today",
      coalesce(sum(oi.total_litres - coalesce(ret.rlitres, 0)) filter (where o.order_date >= b.wstart), 0)::numeric as "week",
      coalesce(sum(oi.total_litres - coalesce(ret.rlitres, 0)) filter (where o.order_date >= b.mstart), 0)::numeric as "month"
    from users u
    join user_roles ur on ur.user_id = u.id
    join roles r on r.id = ur.role_id and r.code = 'SALES_EXECUTIVE'
    cross join bounds b
    left join orders o
      on o.sales_executive_id = u.id
      and o.order_date between least(b.wstart, b.mstart) and b.today
      and o.order_status <> 'cancelled'
    left join order_items oi on oi.order_id = o.id and oi.product_id is not null
    left join (
      select order_item_id, coalesce(sum(litres), 0) as rlitres
      from sales_return_items
      where kind = 'oil'
      group by order_item_id
    ) ret on ret.order_item_id = oi.id
    where u.status = 'active'
    group by u.id, u.name, oi.segment
  `) as Row[];

  // Pivot (userId, segment) rows → one row per SE with per-period segment maps.
  // Every SE has at least one row (a null-segment row when they have no sales),
  // so all active SEs appear; only the 6 known oil segments are bucketed.
  const known = new Set<string>(OIL_SEGMENTS);
  const bySe = new Map<string, SegmentSalesRow>();
  for (const r of rows) {
    const userId = str(r.userId);
    let row = bySe.get(userId);
    if (!row) {
      row = { userId, name: str(r.name), today: zeroSegments(), week: zeroSegments(), month: zeroSegments() };
      bySe.set(userId, row);
    }
    const segment = str(r.segment);
    if (!known.has(segment)) continue; // null / retired segment → ignore
    const seg = segment as OilSegment;
    row.today[seg] = num(r.today);
    row.week[seg] = num(r.week);
    row.month[seg] = num(r.month);
  }
  return [...bySe.values()];
}
