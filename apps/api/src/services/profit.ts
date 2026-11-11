/**
 * Profitability report (generated invoices only).
 *
 * Profit per line = sold price (ex-GST) − expense share − actual cost, where:
 *   • sold price  = invoice_items.taxable_amount (ex-GST sell value)
 *   • actual cost = invoice_items.cogs_amount (Σ qty × the FEFO-drawn lot rate)
 *   • expense share = lineUnits × expPerUnit
 *   • expPerUnit  = Σ ALL expenditures in the period ÷ Σ units sold in the period
 *   • lineUnits   = litres for oils (qty × pack), pieces for piece-items
 *                   (1 piece counted as 1 litre — a single blended unit pool)
 *
 * The same per-line profit is rolled up four ways: by invoice, customer, SKU, area
 * (customer city). Lots sold with no recorded cost surface as `unpricedLines`, so a
 * group whose cost is incomplete is flagged rather than silently overstated.
 */
import type { SqlClient } from "../lib/db";
import { num, str } from "./orders-shared";
import { round2 } from "./stock-shared";

export type ProfitGroup = "invoice" | "customer" | "sku" | "area";
export interface ProfitFilters { from?: string | null; to?: string | null; groupBy?: string | null }

const GROUPS: ProfitGroup[] = ["invoice", "customer", "sku", "area"];
export function parseProfitGroup(v?: string | null): ProfitGroup {
  return GROUPS.includes(v as ProfitGroup) ? (v as ProfitGroup) : "invoice";
}

export interface ProfitRow {
  key: string; label: string; sub: string | null;
  units: number; soldValue: number; cost: number; expenseValue: number; profit: number;
  marginPct: number | null; lines: number; unpricedLines: number;
}

interface RawGroup { key: unknown; label: unknown; sub?: unknown; units: unknown; sold: unknown; cost: unknown; lines: unknown; unpricedLines: unknown }

function toRow(r: RawGroup, expPerUnit: number): ProfitRow {
  const units = num(r.units);
  const soldValue = round2(num(r.sold));
  const cost = round2(num(r.cost));
  const expenseValue = round2(units * expPerUnit);
  const profit = round2(soldValue - expenseValue - cost);
  return {
    key: str(r.key), label: str(r.label) || "—", sub: r.sub == null || str(r.sub) === "" ? null : str(r.sub),
    units: round2(units), soldValue, cost, expenseValue, profit,
    marginPct: soldValue > 0 ? round2((profit / soldValue) * 100) : null,
    lines: num(r.lines), unpricedLines: num(r.unpricedLines),
  };
}

export async function profitReport(sql: SqlClient, f: ProfitFilters) {
  const from = f.from?.trim() || null;
  const to = f.to?.trim() || null;
  const groupBy = parseProfitGroup(f.groupBy);

  // 1) The whole expense pool for the period.
  const [e = {}] = await sql`
    /* profit_expenses */
    select coalesce(sum(amount), 0) as "expenses"
    from expenditures
    where (${from}::date is null or expenditure_date >= ${from}::date)
      and (${to}::date is null or expenditure_date <= ${to}::date)
  `;

  // 2) Period sales base (generated invoices only): units sold + sold/cost totals.
  const [b = {}] = await sql`
    /* profit_base */
    select
      coalesce(sum(case when p.unit = 'quantity' then ii.qty_units else ii.qty_units * ii.pack_size_litres end), 0) as "units",
      coalesce(sum(ii.taxable_amount), 0) as "sold",
      coalesce(sum(ii.cogs_amount), 0) as "cost",
      count(*) filter (where ii.cogs_amount is null) as "unpricedLines",
      count(distinct i.id) as "invoices"
    from invoice_items ii
    join invoices i on i.id = ii.invoice_id and i.invoice_source = 'generated' and i.doc_status <> 'cancelled'
    join products p on p.id = ii.product_id
    where (${from}::date is null or i.invoice_date >= ${from}::date)
      and (${to}::date is null or i.invoice_date <= ${to}::date)
  `;

  const expenses = round2(num(e.expenses));
  const unitsSold = num(b.units);
  const soldTotal = round2(num(b.sold));
  const costTotal = round2(num(b.cost));
  const expPerUnit = unitsSold > 0 ? expenses / unitsSold : 0;
  // The whole pool is spread across the sold units, so allocated expense == pool.
  const expenseTotal = unitsSold > 0 ? expenses : 0;
  const profitTotal = round2(soldTotal - expenseTotal - costTotal);

  const totals = {
    invoices: num(b.invoices), units: round2(unitsSold),
    soldValue: soldTotal, cost: costTotal, expenseValue: round2(expenseTotal), expenses,
    profit: profitTotal, marginPct: soldTotal > 0 ? round2((profitTotal / soldTotal) * 100) : null,
    expPerUnit: round2(expPerUnit), unpricedLines: num(b.unpricedLines),
  };

  const rows = (await runGroup(sql, groupBy, from, to)).map((r) => toRow(r, expPerUnit));
  return { groupBy, totals, rows };
}

/** The per-group aggregate query for the requested breakdown. The aggregates
 *  (units / sold / cost / lines / unpricedLines) and the generated-only date filter
 *  are the same across groups; only the grouping key/label and customer join differ.
 *  Written as four full tagged templates — the Neon driver composes params, not
 *  interpolated SQL fragments. */
async function runGroup(sql: SqlClient, groupBy: ProfitGroup, from: string | null, to: string | null): Promise<RawGroup[]> {
  if (groupBy === "customer") {
    return sql`
      /* profit_by_customer */
      select i.customer_id as "key", c.legal_name as "label", null as "sub",
        coalesce(sum(case when p.unit = 'quantity' then ii.qty_units else ii.qty_units * ii.pack_size_litres end), 0) as "units",
        coalesce(sum(ii.taxable_amount), 0) as "sold",
        coalesce(sum(ii.cogs_amount), 0) as "cost",
        count(*) as "lines",
        count(*) filter (where ii.cogs_amount is null) as "unpricedLines"
      from invoice_items ii
      join invoices i on i.id = ii.invoice_id
      join products p on p.id = ii.product_id
      join customers c on c.id = i.customer_id
      where i.invoice_source = 'generated' and i.doc_status <> 'cancelled'
        and (${from}::date is null or i.invoice_date >= ${from}::date)
        and (${to}::date is null or i.invoice_date <= ${to}::date)
      group by i.customer_id, c.legal_name
      order by "sold" desc limit 1000
    ` as unknown as RawGroup[];
  }
  if (groupBy === "sku") {
    return sql`
      /* profit_by_sku */
      select p.id || ':' || ii.pack_size_litres as "key", p.product_name as "label",
        coalesce(ii.brand, p.brand) as "sub",
        coalesce(sum(case when p.unit = 'quantity' then ii.qty_units else ii.qty_units * ii.pack_size_litres end), 0) as "units",
        coalesce(sum(ii.taxable_amount), 0) as "sold",
        coalesce(sum(ii.cogs_amount), 0) as "cost",
        count(*) as "lines",
        count(*) filter (where ii.cogs_amount is null) as "unpricedLines"
      from invoice_items ii
      join invoices i on i.id = ii.invoice_id
      join products p on p.id = ii.product_id
      where i.invoice_source = 'generated' and i.doc_status <> 'cancelled'
        and (${from}::date is null or i.invoice_date >= ${from}::date)
        and (${to}::date is null or i.invoice_date <= ${to}::date)
      group by p.id, p.product_name, ii.pack_size_litres, coalesce(ii.brand, p.brand)
      order by "sold" desc limit 1000
    ` as unknown as RawGroup[];
  }
  if (groupBy === "area") {
    return sql`
      /* profit_by_area */
      select coalesce(nullif(trim(c.address_city), ''), '(no city)') as "key",
        coalesce(nullif(trim(c.address_city), ''), '(no city)') as "label", null as "sub",
        coalesce(sum(case when p.unit = 'quantity' then ii.qty_units else ii.qty_units * ii.pack_size_litres end), 0) as "units",
        coalesce(sum(ii.taxable_amount), 0) as "sold",
        coalesce(sum(ii.cogs_amount), 0) as "cost",
        count(*) as "lines",
        count(*) filter (where ii.cogs_amount is null) as "unpricedLines"
      from invoice_items ii
      join invoices i on i.id = ii.invoice_id
      join products p on p.id = ii.product_id
      join customers c on c.id = i.customer_id
      where i.invoice_source = 'generated' and i.doc_status <> 'cancelled'
        and (${from}::date is null or i.invoice_date >= ${from}::date)
        and (${to}::date is null or i.invoice_date <= ${to}::date)
      group by coalesce(nullif(trim(c.address_city), ''), '(no city)')
      order by "sold" desc limit 1000
    ` as unknown as RawGroup[];
  }
  return sql`
    /* profit_by_invoice */
    select i.id as "key", i.invoice_number as "label",
      c.legal_name || ' · ' || to_char(i.invoice_date, 'DD Mon YYYY') as "sub",
      coalesce(sum(case when p.unit = 'quantity' then ii.qty_units else ii.qty_units * ii.pack_size_litres end), 0) as "units",
      coalesce(sum(ii.taxable_amount), 0) as "sold",
      coalesce(sum(ii.cogs_amount), 0) as "cost",
      count(*) as "lines",
      count(*) filter (where ii.cogs_amount is null) as "unpricedLines"
    from invoice_items ii
    join invoices i on i.id = ii.invoice_id
    join products p on p.id = ii.product_id
    join customers c on c.id = i.customer_id
    where i.invoice_source = 'generated' and i.doc_status <> 'cancelled'
      and (${from}::date is null or i.invoice_date >= ${from}::date)
      and (${to}::date is null or i.invoice_date <= ${to}::date)
    group by i.id, i.invoice_number, c.legal_name, i.invoice_date
    order by "sold" desc limit 1000
  ` as unknown as RawGroup[];
}
