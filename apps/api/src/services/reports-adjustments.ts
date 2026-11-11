import type { SqlClient } from "../lib/db";
import { OIL_SEGMENTS } from "./targets";

/**
 * Cancelled + Returned reports — OILS ONLY (this distributor is oils-only; the
 * Beyond original also tracked bearings, which don't exist here). Litres by
 * executive × segment, split into Partially vs Fully, plus the share of that
 * executive's GROSS ordered (incl. cancelled) volume in the period.
 *
 * Cancelled: fully-cancelled orders (order_status='cancelled') + short-closed
 *   remainders (order_items.cancelled_units > 0 on live orders), by order_date.
 * Returned: sales_return_items by return_date; an order is "fully" returned when
 *   all its billed units are returned, else "partially".
 *
 * `brand` (optional) narrows to one oil brand via order_items.brand; null = all.
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
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

export interface AdjSegRow {
  userId: string;
  name: string;
  partial: Record<string, number>;
  full: Record<string, number>;
  partialTotal: number;
  fullTotal: number;
  total: number;
  orderedLitres: number;
  percent: number;
}
export interface AdjustmentReport {
  segments: string[];
  oils: AdjSegRow[];
}

/** Gross ordered litres per SE in the period (original volume, incl. cancelled). */
async function grossOrdered(sql: SqlClient, start: string, end: string, brand: string | null) {
  const rows = (await sql`
    /* reports_adj_gross_ordered */
    select o.sales_executive_id as "se",
      coalesce(sum(oi.total_litres + coalesce(oi.cancelled_units, 0) * oi.pack_size_litres), 0)::numeric as "litres"
    from orders o
    join order_items oi on oi.order_id = o.id and oi.product_id is not null
    where o.order_date between ${start}::date and ${end}::date
      and (${brand}::text is null or oi.brand = ${brand})
    group by o.sales_executive_id
  `) as Row[];
  const map = new Map<string, number>();
  for (const r of rows) map.set(str(r.se), num(r.litres));
  return map;
}

/** Assemble oil rows (each with a `kind` of 'partial'|'full') into the report
 *  shape, attach the % of gross ordered, drop empty SEs/segments. */
function assemble(oilRows: Row[], ordered: Map<string, number>): AdjustmentReport {
  const oilBySe = new Map<string, AdjSegRow>();
  for (const r of oilRows) {
    const se = str(r.se);
    if (!se) continue;
    const seg = str(r.segment);
    const litres = num(r.litres);
    if (!seg || litres === 0) continue;
    if (!oilBySe.has(se)) {
      oilBySe.set(se, {
        userId: se, name: str(r.name) || "Unassigned",
        partial: {}, full: {}, partialTotal: 0, fullTotal: 0, total: 0, orderedLitres: 0, percent: 0,
      });
    }
    const row = oilBySe.get(se)!;
    const bucket = str(r.kind) === "full" ? row.full : row.partial;
    bucket[seg] = (bucket[seg] ?? 0) + litres;
    if (str(r.kind) === "full") row.fullTotal += litres;
    else row.partialTotal += litres;
    row.total += litres;
  }
  for (const row of oilBySe.values()) {
    row.orderedLitres = ordered.get(row.userId) ?? 0;
    row.percent = pct(row.total, row.orderedLitres);
  }
  const oils = [...oilBySe.values()].filter((r) => r.total > 0).sort((a, b) => b.total - a.total);
  const segments = OIL_SEGMENTS.filter((s) => oils.some((r) => (r.partial[s] ?? 0) > 0 || (r.full[s] ?? 0) > 0));
  return { segments: [...segments], oils };
}

export async function buildCancelled(
  sql: SqlClient,
  start: string,
  end: string,
  brand: string | null,
): Promise<AdjustmentReport> {
  const [oilRows, ordered] = await Promise.all([
    sql`/* reports_cancelled_oils */
      select x.se as "se", coalesce(u.name, 'Unassigned') as "name", x.segment as "segment", x.kind as "kind",
        sum(x.litres)::numeric as "litres"
      from (
        select o.sales_executive_id as se, oi.segment, 'full'::text as kind, oi.total_litres as litres
        from orders o join order_items oi on oi.order_id = o.id and oi.product_id is not null
        where o.order_status = 'cancelled' and o.order_date between ${start}::date and ${end}::date
          and (${brand}::text is null or oi.brand = ${brand})
        union all
        select o.sales_executive_id, oi.segment, 'partial', coalesce(oi.cancelled_units, 0) * oi.pack_size_litres
        from orders o join order_items oi on oi.order_id = o.id and oi.product_id is not null
        where o.order_status <> 'cancelled' and coalesce(oi.cancelled_units, 0) > 0
          and o.order_date between ${start}::date and ${end}::date
          and (${brand}::text is null or oi.brand = ${brand})
      ) x
      left join users u on u.id = x.se
      group by x.se, u.name, x.segment, x.kind` as Promise<Row[]>,
    grossOrdered(sql, start, end, brand),
  ]);
  return assemble(oilRows, ordered);
}

export async function buildReturned(
  sql: SqlClient,
  start: string,
  end: string,
  brand: string | null,
): Promise<AdjustmentReport> {
  const [oilRows, ordered] = await Promise.all([
    sql`/* reports_returned_oils */
      with order_ret as (
        select oir.order_id,
          bool_and(coalesce(al.alloc, 0) - coalesce(rt.returned, 0) <= 0.001) as all_returned
        from order_items oir
        left join (
          select ia.order_item_id, sum(ia.quantity_units) as alloc
          from invoice_line_allocations ia
          join invoices iv on iv.id = ia.invoice_id and iv.approval_status <> 'rejected' and iv.doc_status <> 'cancelled'
          group by ia.order_item_id
        ) al on al.order_item_id = oir.id
        left join (
          select order_item_id, sum(quantity_units) as returned from sales_return_items group by order_item_id
        ) rt on rt.order_item_id = oir.id
        where oir.product_id is not null
        group by oir.order_id
      )
      select o.sales_executive_id as "se", coalesce(u.name, 'Unassigned') as "name", sri.segment as "segment",
        case when ores.all_returned then 'full' else 'partial' end as "kind",
        coalesce(sum(sri.litres), 0)::numeric as "litres"
      from sales_return_items sri
      join sales_returns sr on sr.id = sri.sales_return_id
      join order_items oi on oi.id = sri.order_item_id
      join orders o on o.id = oi.order_id
      join order_ret ores on ores.order_id = o.id
      left join users u on u.id = o.sales_executive_id
      where sri.kind = 'oil' and sr.return_date between ${start}::date and ${end}::date
        and (${brand}::text is null or oi.brand = ${brand})
      group by o.sales_executive_id, u.name, sri.segment, ores.all_returned` as Promise<Row[]>,
    grossOrdered(sql, start, end, brand),
  ]);
  return assemble(oilRows, ordered);
}
