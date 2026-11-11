import type { SqlClient } from "../lib/db";

/**
 * Visit / productivity reports (not brand-specific — about field activity).
 *  • Productivity-% trend  — per executive, per month (last 6), productive ÷ visits.
 *  • Customer productivity — each executive's highest & lowest customer by
 *    (productive visits ÷ visits), among customers with ≥ MIN_VISITS visits.
 *  • Visits trend          — monthly visit count per executive (last 6) + org totals.
 *
 * "Productive visit": on the visit's date the same executive+customer has an
 * order, a collection, or a market-intelligence photo (mirrors the dashboard).
 */
type Row = Record<string, unknown>;
function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
}

export const MIN_VISITS = 3;
const TOP_N = 10;
const pctOf = (p: number, v: number): number | null => (v > 0 ? Math.round((p / v) * 1000) / 10 : null);

export interface ProductivityTrendRow {
  userId: string;
  name: string;
  points: { month: string; visits: number; productive: number; pct: number | null }[];
}
export interface ProductivityTrend {
  months: string[];
  rows: ProductivityTrendRow[];
}

/** Per-executive monthly productivity %, trailing 6 months. */
export async function buildProductivityTrend(sql: SqlClient): Promise<ProductivityTrend> {
  const rows = (await sql`
    /* reports_productivity_trend */
    with months as (
      select to_char(date_trunc('month', (now() at time zone 'Asia/Kolkata')::date) - (i || ' months')::interval, 'YYYY-MM') as month
      from generate_series(0, 5) i
    ),
    base as (
      select v.executive_id as se, to_char(date_trunc('month', v.visit_date), 'YYYY-MM') as month,
        count(*) as visits,
        count(*) filter (where exists (
          select 1 from orders po where po.customer_id = v.customer_id and po.sales_executive_id = v.executive_id and po.order_date = v.visit_date
        ) or exists (
          select 1 from collections pc where pc.customer_id = v.customer_id and pc.collected_by_user_id = v.executive_id and pc.collection_date = v.visit_date
        ) or exists (
          select 1 from customer_photos pp where pp.customer_id = v.customer_id and pp.uploaded_by = v.executive_id
            and pp.category = 'market_intelligence' and (pp.created_at at time zone 'Asia/Kolkata')::date = v.visit_date
        )) as productive
      from visits v
      where v.visit_date >= (date_trunc('month', (now() at time zone 'Asia/Kolkata')::date) - interval '5 months')::date
      group by v.executive_id, to_char(date_trunc('month', v.visit_date), 'YYYY-MM')
    )
    select u.id as "se", u.name as "name", m.month as "month",
      coalesce(b.visits, 0)::int as "visits", coalesce(b.productive, 0)::int as "productive"
    from (select distinct se from base) execs
    join users u on u.id = execs.se
    cross join months m
    left join base b on b.se = execs.se and b.month = m.month
    order by u.name, m.month
  `) as Row[];

  const monthSet: string[] = [];
  const byExec = new Map<string, ProductivityTrendRow>();
  for (const r of rows) {
    const se = str(r.se);
    const month = str(r.month);
    if (!monthSet.includes(month)) monthSet.push(month);
    if (!byExec.has(se)) byExec.set(se, { userId: se, name: str(r.name), points: [] });
    const visits = num(r.visits);
    const productive = num(r.productive);
    byExec.get(se)!.points.push({ month, visits, productive, pct: pctOf(productive, visits) });
  }
  const months = [...monthSet].sort((a, b) => a.localeCompare(b));
  for (const row of byExec.values()) row.points.sort((a, b) => a.month.localeCompare(b.month));
  return { months, rows: [...byExec.values()].sort((a, b) => a.name.localeCompare(b.name)) };
}

export interface VisitsExecRow {
  userId: string;
  name: string;
  points: { month: string; total: number }[];
  total: number;
}
export interface VisitsTrend {
  months: string[];
  rows: VisitsExecRow[];
  totals: { month: string; total: number }[];
  grandTotal: number;
}

/** Monthly visits per executive (trailing 6 months) + org totals. */
export async function buildVisitsTrend(sql: SqlClient): Promise<VisitsTrend> {
  const rows = (await sql`
    /* reports_visits_trend */
    with months as (
      select to_char(date_trunc('month', (now() at time zone 'Asia/Kolkata')::date) - (i || ' months')::interval, 'YYYY-MM') as month
      from generate_series(0, 5) i
    ),
    base as (
      select v.executive_id as se, to_char(date_trunc('month', v.visit_date), 'YYYY-MM') as month, count(*) as total
      from visits v
      where v.visit_date >= (date_trunc('month', (now() at time zone 'Asia/Kolkata')::date) - interval '5 months')::date
      group by v.executive_id, to_char(date_trunc('month', v.visit_date), 'YYYY-MM')
    )
    select u.id as "se", u.name as "name", m.month as "month", coalesce(b.total, 0)::int as "total"
    from (select distinct se from base) execs
    join users u on u.id = execs.se
    cross join months m
    left join base b on b.se = execs.se and b.month = m.month
    order by u.name, m.month
  `) as Row[];

  const monthSet: string[] = [];
  const byExec = new Map<string, VisitsExecRow>();
  for (const r of rows) {
    const se = str(r.se);
    const month = str(r.month);
    const total = num(r.total);
    if (!monthSet.includes(month)) monthSet.push(month);
    if (!byExec.has(se)) byExec.set(se, { userId: se, name: str(r.name), points: [], total: 0 });
    const row = byExec.get(se)!;
    row.points.push({ month, total });
    row.total += total;
  }
  const months = [...monthSet].sort((a, b) => a.localeCompare(b));
  for (const row of byExec.values()) row.points.sort((a, b) => a.month.localeCompare(b.month));
  const execRows = [...byExec.values()].sort((a, b) => a.name.localeCompare(b.name));
  const totals = months.map((m) => ({
    month: m,
    total: execRows.reduce((sum, r) => sum + (r.points.find((p) => p.month === m)?.total ?? 0), 0),
  }));
  const grandTotal = totals.reduce((sum, t) => sum + t.total, 0);
  return { months, rows: execRows, totals, grandTotal };
}

export interface CustProdEntry {
  customer: string;
  visits: number;
  productive: number;
  pct: number | null;
}
export interface CustProdRow {
  userId: string;
  name: string;
  highest: CustProdEntry[];
  lowest: CustProdEntry[];
}

/** Each executive's top-N highest & lowest productivity customers (ratio, min
 *  MIN_VISITS visits), over ALL history (ignores the page's range). */
export async function buildCustomerProductivity(
  sql: SqlClient,
): Promise<{ rows: CustProdRow[]; minVisits: number; topN: number }> {
  const rows = (await sql`
    /* reports_customer_productivity */
    with cust as (
      select v.executive_id as se, v.customer_id as cid,
        count(*) as visits,
        count(*) filter (where exists (
          select 1 from orders po where po.customer_id = v.customer_id and po.sales_executive_id = v.executive_id and po.order_date = v.visit_date
        ) or exists (
          select 1 from collections pc where pc.customer_id = v.customer_id and pc.collected_by_user_id = v.executive_id and pc.collection_date = v.visit_date
        ) or exists (
          select 1 from customer_photos pp where pp.customer_id = v.customer_id and pp.uploaded_by = v.executive_id
            and pp.category = 'market_intelligence' and (pp.created_at at time zone 'Asia/Kolkata')::date = v.visit_date
        )) as productive
      from visits v
      group by v.executive_id, v.customer_id
      having count(*) >= ${MIN_VISITS}
    ),
    ranked as (
      select se, cid, visits, productive,
        row_number() over (partition by se order by (productive::numeric / visits) desc, visits desc) as hi,
        row_number() over (partition by se order by (productive::numeric / visits) asc, visits desc) as lo
      from cust
    )
    select r.se as "se", u.name as "name", c.legal_name as "customer",
      r.visits::int as "visits", r.productive::int as "productive",
      r.hi::int as "hi", r.lo::int as "lo"
    from ranked r
    join users u on u.id = r.se
    join customers c on c.id = r.cid
    where r.hi <= ${TOP_N} or r.lo <= ${TOP_N}
    order by u.name
  `) as Row[];

  const byExec = new Map<string, CustProdRow & { _hi: { rank: number; e: CustProdEntry }[]; _lo: { rank: number; e: CustProdEntry }[] }>();
  for (const r of rows) {
    const se = str(r.se);
    if (!byExec.has(se)) byExec.set(se, { userId: se, name: str(r.name), highest: [], lowest: [], _hi: [], _lo: [] });
    const row = byExec.get(se)!;
    const entry: CustProdEntry = {
      customer: str(r.customer),
      visits: num(r.visits),
      productive: num(r.productive),
      pct: pctOf(num(r.productive), num(r.visits)),
    };
    const hi = num(r.hi);
    const lo = num(r.lo);
    if (hi <= TOP_N) row._hi.push({ rank: hi, e: entry });
    if (lo <= TOP_N) row._lo.push({ rank: lo, e: entry });
  }
  const result = [...byExec.values()]
    .map((row) => ({
      userId: row.userId,
      name: row.name,
      highest: row._hi.sort((a, b) => a.rank - b.rank).map((x) => x.e),
      lowest: row._lo.sort((a, b) => a.rank - b.rank).map((x) => x.e),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { rows: result, minVisits: MIN_VISITS, topN: TOP_N };
}
