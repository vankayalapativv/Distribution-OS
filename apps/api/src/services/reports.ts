import type { SqlClient } from "../lib/db";
import { OIL_SEGMENTS } from "./targets";
import { getCustomerAnalytics } from "./dashboard-analytics";
import { getSkuAnalytics } from "./sku-analytics";
import { buildCancelled, buildReturned, type AdjustmentReport } from "./reports-adjustments";
import { getAttendanceSummary, type AttendanceSummaryRow } from "./attendance";
import {
  buildCustomerProductivity,
  buildProductivityTrend,
  buildVisitsTrend,
  type CustProdRow,
  type ProductivityTrend,
  type VisitsTrend,
} from "./reports-visits";

/** Normalize a brand filter: blank / "all" → null (= every brand). */
function normBrand(v: string | null | undefined): string | null {
  const b = (v ?? "").trim();
  return b && b.toLowerCase() !== "all" ? b : null;
}

/**
 * Client report bundle — the six reports emailed to the client (and shown on
 * the web Reports page), computed for one resolved IST period.
 *
 * Decisions (locked with the client 2026-08-04):
 *  1 Sales by segment      — oil LITRES per segment, from orders (net of returns)
 *  2 Collection by segment — ₹ collected, attributed to the CUSTOMER's segment(s),
 *                            verified + pending (rejected excluded), split equally
 *                            across a multi-segment customer's segments
 *  3 Travelled distance    — total km per SE (+ LOGISTICS drivers), from GPS sessions
 *  4 New-customer onboarding — count of customers each SE created in the period
 *  5 Oils analytics        — oils ranked within each segment, litres + share
 *  6 Backlog               — invoices with no delivery stop yet (a CURRENT snapshot,
 *                            not period-bounded), grouped by SE with age
 *
 * Per-executive reports list ALL active SEs (zero rows included).
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

function isoDate(v: unknown): string {
  return str(v).slice(0, 10);
}

// ---- period math (plain YYYY-MM-DD; IST has no DST so date-only is safe) ----

export type ReportCadence = "daily" | "weekly" | "fortnightly" | "monthly";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** Monday of the week containing `iso`. */
function mondayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Mon = 0
  return addDays(iso, -dow);
}
function firstOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}
function pretty(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}

export interface ReportPeriod {
  cadence: ReportCadence;
  start: string;
  end: string;
  label: string;
}

/**
 * The window a given cadence covers when fired on `anchor` (IST date). Weekly,
 * fortnightly and monthly cover the just-completed period; daily is the anchor day.
 */
export function resolvePeriod(cadence: ReportCadence, anchor: string): ReportPeriod {
  let start: string;
  let end: string;
  if (cadence === "daily") {
    start = anchor;
    end = anchor;
  } else if (cadence === "weekly") {
    const prevMonday = addDays(mondayOf(anchor), -7);
    start = prevMonday;
    end = addDays(prevMonday, 6);
  } else if (cadence === "fortnightly") {
    const day = Number(anchor.slice(8, 10));
    if (day >= 16) {
      start = firstOfMonth(anchor);
      end = addDays(firstOfMonth(anchor), 14); // 1st–15th
    } else {
      const prevLast = addDays(firstOfMonth(anchor), -1);
      start = addDays(firstOfMonth(prevLast), 15); // 16th of prev month
      end = prevLast; // end of prev month
    }
  } else {
    const prevLast = addDays(firstOfMonth(anchor), -1); // last day of previous month
    start = firstOfMonth(prevLast);
    end = prevLast;
  }
  const label =
    start === end ? pretty(start) : `${pretty(start)} – ${pretty(end)}`;
  return { cadence, start, end, label };
}

const isYmd = (s: string | null | undefined): s is string =>
  !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export interface ReportOptions {
  cadence: ReportCadence;
  anchor?: string | null;
  /** Explicit inclusive date range (yyyy-mm-dd). When both are set they OVERRIDE
   *  the cadence preset — this is what the interactive Reports page sends. The
   *  scheduled email never sets these, so it keeps its cadence window. */
  from?: string | null;
  to?: string | null;
  /** Oil brand filter (e.g. "Fuchs" / "Savsol"); blank/"all"/absent = all brands.
   *  Only narrows the product/oil reports; reports with no brand dimension ignore it. */
  brand?: string | null;
}

/**
 * The period the report data covers, plus the backlog "as-of" anchor. An explicit
 * from/to range wins over the cadence preset (order-tolerant). For a custom range
 * the backlog stays a CURRENT snapshot (anchor = today), matching the page's
 * "snapshot reports stay live" behavior.
 */
export function resolveWindow(opts: ReportOptions, today: string): { period: ReportPeriod; anchor: string } {
  if (isYmd(opts.from) && isYmd(opts.to)) {
    const [start, end] = opts.from <= opts.to ? [opts.from, opts.to] : [opts.to, opts.from];
    const label = start === end ? pretty(start) : `${pretty(start)} – ${pretty(end)}`;
    return { period: { cadence: opts.cadence, start, end, label }, anchor: today };
  }
  const anchor = isYmd(opts.anchor) ? opts.anchor : today;
  return { period: resolvePeriod(opts.cadence, anchor), anchor };
}

// ---- rosters ----

async function activeSalesExecutives(sql: SqlClient): Promise<{ id: string; name: string }[]> {
  const rows = (await sql`
    /* reports_active_ses */
    select u.id, u.name
    from users u
    join user_roles ur on ur.user_id = u.id
    join roles r on r.id = ur.role_id
    where r.code = 'SALES_EXECUTIVE' and u.status = 'active'
    order by u.name
  `) as Row[];
  return rows.map((r) => ({ id: str(r.id), name: str(r.name) }));
}

async function activeFieldUsers(sql: SqlClient): Promise<{ id: string; name: string; role: string }[]> {
  const rows = (await sql`
    /* reports_active_field_users */
    select u.id, u.name,
      (array_agg(r.code order by r.code))[1] as role
    from users u
    join user_roles ur on ur.user_id = u.id
    join roles r on r.id = ur.role_id
    where r.code in ('SALES_EXECUTIVE', 'LOGISTICS') and u.status = 'active'
    group by u.id, u.name
    order by role, u.name
  `) as Row[];
  return rows.map((r) => ({ id: str(r.id), name: str(r.name), role: str(r.role) }));
}

// ---- report builders ----

export interface SalesRow { userId: string; name: string; segments: Record<string, number>; total: number }

/** #1 Oil litres per segment, per SE (orders, net of returns). Brand-filterable. */
async function buildSales(sql: SqlClient, start: string, end: string, roster: { id: string; name: string }[], brand: string | null) {
  const rows = (await sql`
    /* reports_sales_by_segment */
    select o.sales_executive_id as "userId", oi.segment as "segment",
      coalesce(sum(oi.total_litres - coalesce(ret.rlitres, 0)), 0)::numeric as "litres"
    from orders o
    join order_items oi on oi.order_id = o.id and oi.product_id is not null
    left join (
      select order_item_id, coalesce(sum(litres), 0) as rlitres
      from sales_return_items where kind = 'oil' group by order_item_id
    ) ret on ret.order_item_id = oi.id
    where o.sales_executive_id is not null
      and o.order_status <> 'cancelled'
      and o.order_date between ${start}::date and ${end}::date
      and (${brand}::text is null or oi.brand = ${brand})
    group by o.sales_executive_id, oi.segment
  `) as Row[];
  const byUser = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const uid = str(r.userId);
    const seg = str(r.segment);
    if (!uid || !seg) continue;
    if (!byUser.has(uid)) byUser.set(uid, new Map());
    byUser.get(uid)!.set(seg, num(r.litres));
  }
  const resultRows: SalesRow[] = roster.map((se) => {
    const map = byUser.get(se.id) ?? new Map();
    const segments: Record<string, number> = {};
    let total = 0;
    for (const seg of OIL_SEGMENTS) {
      const v = map.get(seg) ?? 0;
      segments[seg] = v;
      total += v;
    }
    return { userId: se.id, name: se.name, segments, total };
  });
  return { segments: [...OIL_SEGMENTS], rows: resultRows };
}

export interface CollectionRow { userId: string; name: string; segments: Record<string, number>; total: number }

/** Alphabetical segment order with "Unspecified" pinned last. */
function compareSegments(a: string, b: string): number {
  if (a === "Unspecified") return 1;
  if (b === "Unspecified") return -1;
  return a.localeCompare(b);
}

/** #2 ₹ collected per SE, attributed to the customer's segment(s), verified+pending. */
async function buildCollections(sql: SqlClient, start: string, end: string, roster: { id: string; name: string }[]) {
  const rows = (await sql`
    /* reports_collections_by_customer_segment */
    select c.collected_by_user_id as "userId", cu.segment as "segment",
      c.collection_amount as "amount"
    from collections c
    join customers cu on cu.id = c.customer_id
    where c.accountant_approval_status in ('pending', 'verified')
      and c.payment_mode <> 'credit_note'  -- credit notes aren't cash collected
      and c.collection_date between ${start}::date and ${end}::date
  `) as Row[];
  const byUser = new Map<string, Map<string, number>>();
  const segSet = new Set<string>();
  for (const r of rows) {
    const uid = str(r.userId);
    if (!uid) continue;
    const amount = num(r.amount);
    const tokens = str(r.segment).split(",").map((s) => s.trim()).filter(Boolean);
    const buckets = tokens.length > 0 ? tokens : ["Unspecified"];
    const share = amount / buckets.length;
    if (!byUser.has(uid)) byUser.set(uid, new Map());
    const m = byUser.get(uid)!;
    for (const seg of buckets) {
      segSet.add(seg);
      m.set(seg, (m.get(seg) ?? 0) + share);
    }
  }
  const segments = [...segSet].sort(compareSegments);
  const resultRows: CollectionRow[] = roster.map((se) => {
    const map = byUser.get(se.id) ?? new Map();
    const out: Record<string, number> = {};
    let total = 0;
    for (const seg of segments) {
      const v = map.get(seg) ?? 0;
      out[seg] = v;
      total += v;
    }
    return { userId: se.id, name: se.name, segments: out, total };
  });
  return { segments, rows: resultRows };
}

export interface DistanceRow { userId: string; name: string; role: string; km: number }

/** #3 Total km per SE (+ logistics), from GPS session distance. */
async function buildDistance(sql: SqlClient, start: string, end: string, roster: { id: string; name: string; role: string }[]) {
  const rows = (await sql`
    /* reports_distance */
    select s.user_id as "userId", coalesce(sum(s.total_distance_km), 0)::numeric as "km"
    from gps_tracking_sessions s
    where s.session_date between ${start}::date and ${end}::date
    group by s.user_id
  `) as Row[];
  const km = new Map<string, number>();
  for (const r of rows) km.set(str(r.userId), num(r.km));
  const resultRows: DistanceRow[] = roster.map((u) => ({
    userId: u.id,
    name: u.name,
    role: u.role,
    km: Math.round((km.get(u.id) ?? 0) * 100) / 100,
  }));
  return { rows: resultRows };
}

export interface OnboardingRow { userId: string; name: string; count: number }

/** #4 New customers created by each SE in the period (IST). */
async function buildOnboarding(sql: SqlClient, start: string, end: string, roster: { id: string; name: string }[]) {
  const rows = (await sql`
    /* reports_onboarding */
    select cu.created_by as "userId", count(*)::int as "n"
    from customers cu
    where cu.created_by is not null
      and (cu.created_at at time zone 'Asia/Kolkata')::date between ${start}::date and ${end}::date
    group by cu.created_by
  `) as Row[];
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(str(r.userId), num(r.n));
  const resultRows: OnboardingRow[] = roster.map((se) => ({
    userId: se.id,
    name: se.name,
    count: counts.get(se.id) ?? 0,
  }));
  return { rows: resultRows };
}

interface OilProduct {
  product: string;
  litres: number;
  share: number;
  quantity: number;
  orders: number;
  customers: number;
}

export interface OilSegmentGroup {
  segment: string;
  totalLitres: number;
  products: OilProduct[];
}

/** #5 Oils within each segment, net of returns. Enriched (2026-08-26, moved from
 *  the dashboard "Oils — by segment"): per product we now also carry quantity,
 *  order count, and distinct-customer count. The email/charts read only
 *  `segment` + `totalLitres`, so the added product fields are backward-safe. */
async function buildOilsAnalytics(sql: SqlClient, start: string, end: string, brand: string | null) {
  const rows = (await sql`
    /* reports_oils_by_segment */
    select oi.segment as "segment", p.product_name as "product",
      coalesce(sum(oi.total_litres - coalesce(ret.rlitres, 0)), 0)::numeric as "litres",
      coalesce(sum(oi.quantity_units), 0)::numeric as "quantity",
      count(distinct o.id)::int as "orders",
      count(distinct o.customer_id)::int as "customers"
    from orders o
    join order_items oi on oi.order_id = o.id and oi.product_id is not null
    join products p on p.id = oi.product_id
    left join (
      select order_item_id, coalesce(sum(litres), 0) as rlitres
      from sales_return_items where kind = 'oil' group by order_item_id
    ) ret on ret.order_item_id = oi.id
    where o.order_status <> 'cancelled'
      and o.order_date between ${start}::date and ${end}::date
      and (${brand}::text is null or oi.brand = ${brand})
    group by oi.segment, p.product_name
  `) as Row[];
  const bySeg = new Map<string, Omit<OilProduct, "share">[]>();
  for (const r of rows) {
    const seg = str(r.segment);
    const litres = num(r.litres);
    if (!seg || litres <= 0) continue;
    if (!bySeg.has(seg)) bySeg.set(seg, []);
    bySeg.get(seg)!.push({
      product: str(r.product),
      litres,
      quantity: num(r.quantity),
      orders: num(r.orders),
      customers: num(r.customers),
    });
  }
  const groups: OilSegmentGroup[] = OIL_SEGMENTS.filter((s) => bySeg.has(s)).map((segment) => {
    const products = (bySeg.get(segment) ?? []).sort((a, b) => b.litres - a.litres);
    const totalLitres = products.reduce((s, p) => s + p.litres, 0);
    return {
      segment,
      totalLitres,
      products: products.map((p) => ({
        ...p,
        share: totalLitres > 0 ? Math.round((p.litres / totalLitres) * 1000) / 10 : 0,
      })),
    };
  });
  return { groups };
}

export interface BacklogGroup {
  userId: string | null;
  name: string;
  invoices: { invoiceNo: string; customer: string; invoiceDate: string; ageDays: number; value: number }[];
  totalValue: number;
  count: number;
}

/** #6 Invoices with no delivery stop yet — a current snapshot as of `asOf`. */
async function buildBacklog(sql: SqlClient, asOf: string) {
  const rows = (await sql`
    /* reports_backlog_undelivered */
    select i.sales_executive_id as "userId", coalesce(u.name, 'Unassigned') as "seName",
      i.invoice_number as "invoiceNo", cu.legal_name as "customer",
      i.invoice_date as "invoiceDate", i.invoice_net_value as "value",
      (${asOf}::date - i.invoice_date) as "ageDays"
    from invoices i
    join customers cu on cu.id = i.customer_id
    left join users u on u.id = i.sales_executive_id
    where i.doc_status <> 'cancelled' and not exists (
      select 1 from delivery_run_stops drs where drs.invoice_id = i.id
    )
    order by u.name nulls last, i.invoice_date
  `) as Row[];
  const byUser = new Map<string, BacklogGroup>();
  let totalValue = 0;
  let totalCount = 0;
  for (const r of rows) {
    const uid = str(r.userId) || "unassigned";
    if (!byUser.has(uid)) {
      byUser.set(uid, { userId: str(r.userId) || null, name: str(r.seName), invoices: [], totalValue: 0, count: 0 });
    }
    const g = byUser.get(uid)!;
    const value = num(r.value);
    g.invoices.push({
      invoiceNo: str(r.invoiceNo),
      customer: str(r.customer),
      invoiceDate: isoDate(r.invoiceDate),
      ageDays: num(r.ageDays),
      value,
    });
    g.totalValue += value;
    g.count += 1;
    totalValue += value;
    totalCount += 1;
  }
  return { groups: [...byUser.values()], totalValue, totalCount };
}

export interface OrderedGroup {
  userId: string | null;
  name: string;
  orders: { orderCode: string; customer: string; remainingLitres: number }[];
  totalLitres: number;
  count: number;
}

/**
 * #7 Ordered, not yet invoiced — orders with NO (non-rejected) invoice yet, i.e.
 * the Orders page "Ordered" funnel bucket (invoice existence, NOT per-litre). The
 * full ordered oil is pending, so no allocation/litres subtraction — which also
 * sidesteps the coolant NULL-litres issue that mis-flagged already-invoiced orders.
 * Current snapshot, grouped by SE.
 */
async function buildOrderedNotInvoiced(sql: SqlClient, brand: string | null) {
  const rows = (await sql`
    /* reports_ordered_not_invoiced */
    select o.order_code as "orderCode", o.sales_executive_id as "userId",
      coalesce(u.name, 'Unassigned') as "seName", cu.legal_name as "customer",
      sum(oi.total_litres) as "remaining"
    from orders o
    join order_items oi on oi.order_id = o.id and oi.product_id is not null
    join customers cu on cu.id = o.customer_id
    left join users u on u.id = o.sales_executive_id
    where o.order_status <> 'cancelled'
      and (${brand}::text is null or oi.brand = ${brand})
      and not exists (
        select 1 from invoices iv
        where iv.order_id = o.id and iv.approval_status <> 'rejected' and iv.doc_status <> 'cancelled'
      )
    group by o.order_code, o.sales_executive_id, u.name, cu.legal_name
    order by u.name nulls last, o.order_code
  `) as Row[];
  const byUser = new Map<string, OrderedGroup>();
  let totalLitres = 0;
  let totalCount = 0;
  for (const r of rows) {
    const uid = str(r.userId) || "unassigned";
    if (!byUser.has(uid)) {
      byUser.set(uid, { userId: str(r.userId) || null, name: str(r.seName), orders: [], totalLitres: 0, count: 0 });
    }
    const g = byUser.get(uid)!;
    const remaining = Math.round(num(r.remaining) * 10) / 10;
    g.orders.push({ orderCode: str(r.orderCode), customer: str(r.customer), remainingLitres: remaining });
    g.totalLitres += remaining;
    g.count += 1;
    totalLitres += remaining;
    totalCount += 1;
  }
  return { groups: [...byUser.values()], totalLitres: Math.round(totalLitres * 10) / 10, totalCount };
}

/** #8 Customer analytics — one row per customer with period activity (oils,
 *  orders, collected, pending, last order). Reuses the dashboard query;
 *  active-only (customers with an order or collection in the period). */
async function buildCustomers(sql: SqlClient, start: string, end: string) {
  // getCustomerAnalytics ignores the context in its SQL; pass an empty one.
  const { customers } = await getCustomerAnalytics(
    sql,
    { userId: "" },
    { from: start, to: end },
    { includeInactive: false },
  );
  return { rows: customers };
}

/** #9 Billed SKU analytics (from invoices) — moved from the dashboard SKU tab.
 *  One query feeds two report cards: oils-by-SKU and the 6-month trend. When a
 *  brand is selected the per-SKU list is narrowed to that brand (each SKU carries
 *  its catalogue-matched brand); the 6-month trend stays all-brands (not
 *  brand-specific — see SNAPSHOT/brand notes on the page). */
async function buildSkuBilled(sql: SqlClient, start: string, end: string, brand: string | null) {
  const sku = await getSkuAnalytics(sql, { from: start, to: end });
  if (!brand) return sku;
  return { ...sku, oils: sku.oils.filter((s) => s.brand === brand) };
}

/** 6-month collections trend (monthly total ₹ collected, verified + pending).
 *  Always the trailing 6 months (zero-filled), regardless of the page's range. */
async function buildCollectionsTrend(sql: SqlClient) {
  const rows = (await sql`
    /* reports_collections_trend */
    with months as (
      select to_char(date_trunc('month', (now() at time zone 'Asia/Kolkata')::date) - (i || ' months')::interval, 'YYYY-MM') as month
      from generate_series(0, 5) i
    )
    select m.month as "month", coalesce(sum(c.collection_amount), 0)::numeric as "total"
    from months m
    left join collections c
      on to_char(date_trunc('month', c.collection_date), 'YYYY-MM') = m.month
      and c.accountant_approval_status in ('pending', 'verified')
      and c.payment_mode <> 'credit_note'  -- credit notes aren't cash collected
    group by m.month
    order by m.month
  `) as Row[];
  return { months: rows.map((r) => ({ month: str(r.month), total: num(r.total) })) };
}

// ---- orchestrator ----

export interface ReportBundle {
  period: ReportPeriod;
  generatedAt: string;
  sales: Awaited<ReturnType<typeof buildSales>>;
  collections: Awaited<ReturnType<typeof buildCollections>>;
  distance: Awaited<ReturnType<typeof buildDistance>>;
  onboarding: Awaited<ReturnType<typeof buildOnboarding>>;
  oils: Awaited<ReturnType<typeof buildOilsAnalytics>>;
  backlog: Awaited<ReturnType<typeof buildBacklog>>;
  orderedNotInvoiced: Awaited<ReturnType<typeof buildOrderedNotInvoiced>>;
  customers: Awaited<ReturnType<typeof buildCustomers>>;
  oilsSku: Awaited<ReturnType<typeof buildSkuBilled>>["oils"];
  trend: Awaited<ReturnType<typeof buildSkuBilled>>["months"];
  collectionsTrend: Awaited<ReturnType<typeof buildCollectionsTrend>>;
  cancelled: AdjustmentReport;
  returned: AdjustmentReport;
  productivityTrend: ProductivityTrend;
  customerProductivity: Awaited<ReturnType<typeof buildCustomerProductivity>>;
  visitsTrend: VisitsTrend;
  attendanceSummary: Awaited<ReturnType<typeof getAttendanceSummary>>;
}

export type { AdjustmentReport, ProductivityTrend, VisitsTrend, CustProdRow, AttendanceSummaryRow };

/** IST "today" and a readable "now" stamp, in one round-trip. */
async function istNow(sql: SqlClient): Promise<{ today: string; stamp: string }> {
  const [row] = (await sql`
    /* reports_ist_now */
    select (now() at time zone 'Asia/Kolkata')::date::text as "today",
      to_char(now() at time zone 'Asia/Kolkata', 'DD Mon YYYY, HH24:MI') as "stamp"
  `) as Row[];
  return { today: isoDate(row?.today), stamp: str(row?.stamp) };
}

// ---- per-report + summary (lazy fetching: overview loads the light summary,
//      each report's detail is fetched on demand) ----

export const REPORT_KEYS = [
  "sales",
  "collections",
  "distance",
  "onboarding",
  "oils",
  "backlog",
  "ordered",
  "customers",
  "oilsSku",
  "trend",
  "collectionsTrend",
  "cancelled",
  "returned",
  "productivityTrend",
  "customerProductivity",
  "visitsTrend",
  "attendanceSummary",
] as const;
export type ReportKey = (typeof REPORT_KEYS)[number];

export function isReportKey(v: string): v is ReportKey {
  return (REPORT_KEYS as readonly string[]).includes(v);
}

/** Resolve period + generated-at stamp once, shared by the slice builders. */
async function resolveCtx(sql: SqlClient, opts: ReportOptions) {
  const now = await istNow(sql);
  const { period, anchor } = resolveWindow(opts, now.today);
  return { period, anchor, generatedAt: now.stamp };
}

export type ReportSlice = { period: ReportPeriod; generatedAt: string } & Partial<
  Pick<
    ReportBundle,
    | "sales"
    | "collections"
    | "distance"
    | "onboarding"
    | "oils"
    | "backlog"
    | "orderedNotInvoiced"
    | "customers"
    | "oilsSku"
    | "trend"
    | "collectionsTrend"
    | "cancelled"
    | "returned"
    | "productivityTrend"
    | "customerProductivity"
    | "visitsTrend"
    | "attendanceSummary"
  >
>;

/** Build ONE report's full detail (fetched when a card is opened). */
export async function buildOneReport(
  sql: SqlClient,
  opts: ReportOptions,
  key: ReportKey,
): Promise<ReportSlice> {
  const { period, anchor, generatedAt } = await resolveCtx(sql, opts);
  const brand = normBrand(opts.brand);
  const base = { period, generatedAt };
  switch (key) {
    case "sales":
      return { ...base, sales: await buildSales(sql, period.start, period.end, await activeSalesExecutives(sql), brand) };
    case "collections":
      return { ...base, collections: await buildCollections(sql, period.start, period.end, await activeSalesExecutives(sql)) };
    case "distance":
      return { ...base, distance: await buildDistance(sql, period.start, period.end, await activeFieldUsers(sql)) };
    case "onboarding":
      return { ...base, onboarding: await buildOnboarding(sql, period.start, period.end, await activeSalesExecutives(sql)) };
    case "oils":
      return { ...base, oils: await buildOilsAnalytics(sql, period.start, period.end, brand) };
    case "backlog":
      return { ...base, backlog: await buildBacklog(sql, anchor) };
    case "ordered":
      return { ...base, orderedNotInvoiced: await buildOrderedNotInvoiced(sql, brand) };
    case "customers":
      return { ...base, customers: await buildCustomers(sql, period.start, period.end) };
    case "oilsSku": {
      const sku = await buildSkuBilled(sql, period.start, period.end, brand);
      return { ...base, oilsSku: sku.oils };
    }
    case "trend": {
      const sku = await buildSkuBilled(sql, period.start, period.end, null);
      return { ...base, trend: sku.months };
    }
    case "collectionsTrend":
      return { ...base, collectionsTrend: await buildCollectionsTrend(sql) };
    case "cancelled":
      return { ...base, cancelled: await buildCancelled(sql, period.start, period.end, brand) };
    case "returned":
      return { ...base, returned: await buildReturned(sql, period.start, period.end, brand) };
    case "productivityTrend":
      return { ...base, productivityTrend: await buildProductivityTrend(sql) };
    case "customerProductivity":
      return { ...base, customerProductivity: await buildCustomerProductivity(sql) };
    case "visitsTrend":
      return { ...base, visitsTrend: await buildVisitsTrend(sql) };
    case "attendanceSummary":
      return { ...base, attendanceSummary: await getAttendanceSummary(sql, period.start, period.end) };
  }
}

export interface ReportsSummary {
  oilLitres: number;
  collected: number;
  distanceKm: number;
  newCustomers: number;
  backlogValue: number;
  backlogCount: number;
  pendingOrders: number;
  pendingLitres: number;
  oilSegments: number;
  execCount: number;
  fieldCount: number;
  /** Customers with an order or collection in the period (the Customers report size). */
  customersReported: number;
  /** Invoices in the period (drives the billed-SKU card teasers). */
  billedInvoices: number;
  /** Billed net value (before GST) in the period. */
  billedValue: number;
  /** Total invoiced BEFORE GST (sum of taxable_value) in the period — all invoices. */
  invoicedPreGst: number;
  /** Total invoiced WITH GST (sum of invoice_net_value) in the period — all invoices. */
  invoicedWithGst: number;
}

/** Lightweight headline aggregates for the KPI strip + cards (no row detail). */
export async function buildSummary(
  sql: SqlClient,
  opts: ReportOptions,
): Promise<{ period: ReportPeriod; generatedAt: string; summary: ReportsSummary }> {
  const { period, generatedAt } = await resolveCtx(sql, opts);
  const s = period.start;
  const e = period.end;
  const brand = normBrand(opts.brand);

  const [
    oilRows, collRows, distRows, custRows, backRows, pendRows, execRows, fieldRows, custActiveRows,
    billRows,
  ] = await Promise.all([
      sql`/* reports_sum_oil */
        select coalesce(sum(oi.total_litres - coalesce(ret.rlitres, 0)), 0)::numeric as "litres",
          count(distinct oi.segment) filter (where (oi.total_litres - coalesce(ret.rlitres, 0)) > 0)::int as "segments"
        from orders o
        join order_items oi on oi.order_id = o.id and oi.product_id is not null
        left join (select order_item_id, sum(litres) as rlitres from sales_return_items where kind='oil' group by order_item_id) ret on ret.order_item_id = oi.id
        where o.order_status <> 'cancelled' and o.order_date between ${s}::date and ${e}::date
          and (${brand}::text is null or oi.brand = ${brand})`,
      sql`/* reports_sum_collected */
        select coalesce(sum(collection_amount), 0)::numeric as "v" from collections
        where accountant_approval_status in ('pending','verified') and collection_date between ${s}::date and ${e}::date
          and payment_mode <> 'credit_note'`,
      sql`/* reports_sum_distance */
        select coalesce(sum(total_distance_km), 0)::numeric as "v" from gps_tracking_sessions
        where session_date between ${s}::date and ${e}::date`,
      sql`/* reports_sum_customers */
        select count(*)::int as "v" from customers
        where created_by is not null and (created_at at time zone 'Asia/Kolkata')::date between ${s}::date and ${e}::date`,
      sql`/* reports_sum_backlog */
        select count(*)::int as "c", coalesce(sum(invoice_net_value), 0)::numeric as "v"
        from invoices i where not exists (select 1 from delivery_run_stops drs where drs.invoice_id = i.id)
          and i.doc_status <> 'cancelled'`,
      sql`/* reports_sum_pending */
        select count(distinct o.id)::int as "c", coalesce(sum(oi.total_litres), 0)::numeric as "l"
        from orders o join order_items oi on oi.order_id = o.id and oi.product_id is not null
        where o.order_status <> 'cancelled'
          and (${brand}::text is null or oi.brand = ${brand})
          and not exists (select 1 from invoices iv where iv.order_id = o.id and iv.approval_status <> 'rejected' and iv.doc_status <> 'cancelled')`,
      sql`/* reports_sum_execs */
        select count(distinct u.id)::int as "v" from users u
        join user_roles ur on ur.user_id = u.id join roles r on r.id = ur.role_id
        where r.code = 'SALES_EXECUTIVE' and u.status = 'active'`,
      sql`/* reports_sum_field */
        select count(distinct u.id)::int as "v" from users u
        join user_roles ur on ur.user_id = u.id join roles r on r.id = ur.role_id
        where r.code in ('SALES_EXECUTIVE','LOGISTICS') and u.status = 'active'`,
      sql`/* reports_sum_cust_active */
        select count(*)::int as "v" from (
          select o.customer_id as cust from orders o
            where o.order_status <> 'cancelled' and o.order_date between ${s}::date and ${e}::date
          union
          select col.customer_id from collections col
            where col.accountant_approval_status in ('pending','verified')
              and col.collection_date between ${s}::date and ${e}::date
        ) x`,
      sql`/* reports_sum_billed */
        select count(*)::int as "c",
          coalesce(sum(invoice_net_value), 0)::numeric as "v",
          coalesce(sum(taxable_value), 0)::numeric as "t"
        from invoices where invoice_date between ${s}::date and ${e}::date and doc_status <> 'cancelled'`,
    ]);

  const oil = (oilRows as Row[])[0];
  const back = (backRows as Row[])[0];
  const pend = (pendRows as Row[])[0];
  return {
    period,
    generatedAt,
    summary: {
      oilLitres: num(oil?.litres),
      oilSegments: num(oil?.segments),
      collected: num((collRows as Row[])[0]?.v),
      distanceKm: Math.round(num((distRows as Row[])[0]?.v) * 10) / 10,
      newCustomers: num((custRows as Row[])[0]?.v),
      backlogValue: num(back?.v),
      backlogCount: num(back?.c),
      pendingOrders: num(pend?.c),
      pendingLitres: Math.round(num(pend?.l) * 10) / 10,
      execCount: num((execRows as Row[])[0]?.v),
      fieldCount: num((fieldRows as Row[])[0]?.v),
      customersReported: num((custActiveRows as Row[])[0]?.v),
      billedInvoices: num((billRows as Row[])[0]?.c),
      billedValue: num((billRows as Row[])[0]?.v),
      invoicedPreGst: num((billRows as Row[])[0]?.t),
      invoicedWithGst: num((billRows as Row[])[0]?.v),
    },
  };
}

// ---- per-brand teasers (live numbers for the dedicated brand report cards) ----

export interface BrandTeaser {
  oilLitres: number;
  pendingOrders: number;
  pendingLitres: number;
  billedInvoices: number;
  cancelledLitres: number;
  returnedLitres: number;
}

/** Fold grouped rows into the per-brand teasers: skip blank brands, resolve the
 *  teaser via `get`, and let `apply` write that report's figures onto it. */
function foldByBrand(rows: Row[], get: (b: string) => BrandTeaser, apply: (t: BrandTeaser, r: Row) => void) {
  for (const r of rows) {
    const b = str(r.brand);
    if (b) apply(get(b), r);
  }
}

/**
 * One grouped-by-brand aggregate per product report, so each dedicated brand
 * card can show its real number (oil litres, pending, billed invoices, cancelled
 * / returned litres). A handful of set-based queries + the billed-SKU brand
 * rollup — NOT one summary per brand.
 */
export async function buildBrandsSummary(
  sql: SqlClient,
  opts: ReportOptions,
): Promise<{ period: ReportPeriod; generatedAt: string; brands: Record<string, BrandTeaser> }> {
  const { period, generatedAt } = await resolveCtx(sql, opts);
  const s = period.start;
  const e = period.end;

  const [orderedRows, pendingRows, cancelledRows, returnedRows, sku] = await Promise.all([
    sql`/* reports_brands_ordered */
      select oi.brand as "brand",
        coalesce(sum(oi.total_litres - coalesce(ret.rlitres, 0)), 0)::numeric as "litres"
      from orders o
      join order_items oi on oi.order_id = o.id and oi.product_id is not null
      left join (select order_item_id, sum(litres) as rlitres from sales_return_items where kind='oil' group by order_item_id) ret on ret.order_item_id = oi.id
      where o.order_status <> 'cancelled' and o.order_date between ${s}::date and ${e}::date and oi.brand is not null
      group by oi.brand`,
    sql`/* reports_brands_pending */
      select oi.brand as "brand", count(distinct o.id)::int as "orders",
        coalesce(sum(oi.total_litres), 0)::numeric as "litres"
      from orders o
      join order_items oi on oi.order_id = o.id and oi.product_id is not null
      where o.order_status <> 'cancelled' and oi.brand is not null
        and not exists (select 1 from invoices iv where iv.order_id = o.id and iv.approval_status <> 'rejected' and iv.doc_status <> 'cancelled')
      group by oi.brand`,
    sql`/* reports_brands_cancelled */
      select x.brand as "brand", coalesce(sum(x.litres), 0)::numeric as "litres"
      from (
        select oi.brand, oi.total_litres as litres
        from orders o join order_items oi on oi.order_id = o.id and oi.product_id is not null
        where o.order_status = 'cancelled' and o.order_date between ${s}::date and ${e}::date
        union all
        select oi.brand, coalesce(oi.cancelled_units, 0) * oi.pack_size_litres
        from orders o join order_items oi on oi.order_id = o.id and oi.product_id is not null
        where o.order_status <> 'cancelled' and coalesce(oi.cancelled_units, 0) > 0 and o.order_date between ${s}::date and ${e}::date
      ) x
      where x.brand is not null
      group by x.brand`,
    sql`/* reports_brands_returned */
      select oi.brand as "brand", coalesce(sum(sri.litres), 0)::numeric as "litres"
      from sales_return_items sri
      join sales_returns sr on sr.id = sri.sales_return_id
      join order_items oi on oi.id = sri.order_item_id
      where sri.kind = 'oil' and sr.return_date between ${s}::date and ${e}::date and oi.brand is not null
      group by oi.brand`,
    getSkuAnalytics(sql, { from: s, to: e }),
  ]);

  const brands: Record<string, BrandTeaser> = {};
  const get = (b: string): BrandTeaser => {
    if (!brands[b]) brands[b] = { oilLitres: 0, pendingOrders: 0, pendingLitres: 0, billedInvoices: 0, cancelledLitres: 0, returnedLitres: 0 };
    return brands[b];
  };
  foldByBrand(orderedRows as Row[], get, (t, r) => { t.oilLitres = num(r.litres); });
  foldByBrand(pendingRows as Row[], get, (t, r) => {
    t.pendingOrders = num(r.orders);
    t.pendingLitres = Math.round(num(r.litres) * 10) / 10;
  });
  foldByBrand(cancelledRows as Row[], get, (t, r) => { t.cancelledLitres = num(r.litres); });
  foldByBrand(returnedRows as Row[], get, (t, r) => { t.returnedLitres = num(r.litres); });
  for (const br of sku.brands) { if (br.name && br.name !== "Unmatched") get(br.name).billedInvoices = br.invoices; }

  return { period, generatedAt, brands };
}
