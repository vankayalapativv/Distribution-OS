/** Row/group shapes for each individual report table. Kept apart from the
 *  aggregate types (reports-types.ts) so both files stay small. */

/** SalesRow segments are LITRES; CollectionRow segments are ₹. */
export interface SalesRow {
  userId: string;
  name: string;
  segments: Record<string, number>;
  total: number;
}
export interface CollectionRow {
  userId: string;
  name: string;
  segments: Record<string, number>;
  total: number;
}

export interface DistanceRow {
  userId: string;
  name: string;
  role: string;
  km: number;
}

export interface OnboardingRow {
  userId: string;
  name: string;
  count: number;
}

export interface OilSegmentGroup {
  segment: string;
  totalLitres: number;
  products: {
    product: string;
    litres: number;
    share: number;
    quantity: number;
    orders: number;
    customers: number;
  }[];
}

/** Billed SKU row (from invoices) — flat projection of the backend detail. */
export interface SkuReportRow {
  name: string;
  litres: number;
  quantity: number;
  beforeGst: number;
  invoices: number;
  customers: number;
}

/** One month of the billed 6-month trend. */
export interface TrendMonth {
  month: string;
  litres: number;
  beforeGst: number;
}

export interface BacklogGroup {
  userId: string | null;
  name: string;
  invoices: { invoiceNo: string; customer: string; invoiceDate: string; ageDays: number; value: number }[];
  totalValue: number;
  count: number;
}

export interface OrderedGroup {
  userId: string | null;
  name: string;
  orders: { orderCode: string; customer: string; remainingLitres: number }[];
  totalLitres: number;
  count: number;
}

/** One row per customer with period activity (moved from the dashboard). */
export interface CustomerReportRow {
  customerId: string;
  customerName: string;
  customerCode: string | null;
  salesExecutive: string | null;
  litres: number;
  orders: number;
  collected: number;
  pendingCollections: number;
  lastOrderDate: string | null;
}

/** One month of the 6-month collections trend (₹ total). */
export interface CollectionTrendMonth {
  month: string;
  total: number;
}

/** Cancelled / Returned — oils only (this distributor is oils-only), by
 *  executive × segment with Partially/Fully split + % of gross ordered. */
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

/** Productivity % — per executive, per month (trailing 6). */
export interface ProductivityTrendRow {
  userId: string;
  name: string;
  points: { month: string; visits: number; productive: number; pct: number | null }[];
}
export interface ProductivityTrend {
  months: string[];
  rows: ProductivityTrendRow[];
}

/** Visits — per executive, per month (trailing 6) + org totals. */
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

/** Top & bottom customers by productivity, per executive (all-time). */
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
export interface CustomerProductivity {
  rows: CustProdRow[];
  minVisits: number;
  topN: number;
}

/** Time & attendance — per SE + Logistics person over the range. */
export interface AttendanceSummaryRow {
  userId: string;
  name: string;
  role: string; // SALES_EXECUTIVE | LOGISTICS
  daysPresent: number;
  workingDays: number;
  attendancePct: number | null;
  avgHoursPerDay: number | null;
  avgVisitMinutes: number | null;
  avgVisitsPerDay: number | null;
  totalVisits: number;
}
export interface AttendanceSummary {
  workingDays: number;
  rows: AttendanceSummaryRow[];
}
