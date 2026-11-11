/** Static per-report metadata: full titles (drill-in heading), short card
 *  labels, and the column count each report's loading shimmer draws. */
import type { ReportKey } from "./reports-types";

/** Page header text — shared by the view and its load skeleton so the title
 *  shows instantly (no flash) while the lazy chunk downloads. */
export const REPORTS_TITLE = "Reports";
export const REPORTS_SUBTITLE =
  "Executive & product reports — pick a date range, open a report, and download it as Excel or PDF.";

/** Full titles for the drilled-in report heading. */
export const REPORT_TITLES: Record<ReportKey, string> = {
  sales: "Executive sales by segment",
  collections: "Collections by segment",
  distance: "Distance travelled",
  onboarding: "Customer onboarding",
  oils: "Oils — by segment",
  backlog: "Order backlog",
  ordered: "Ordered, not yet invoiced",
  customers: "Customer analytics",
  oilsSku: "Oils — by SKU (billed)",
  trend: "Last 6 months — billed",
  collectionsTrend: "Last 6 months — collections",
  cancelled: "Cancelled orders",
  returned: "Returned orders",
  productivityTrend: "Productivity % — by executive",
  customerProductivity: "Customer productivity — best & worst",
  visitsTrend: "Last 6 months — visits",
  attendanceSummary: "Time & attendance",
};

/** Shorter titles for the cards. */
export const REPORT_SHORT: Record<ReportKey, string> = {
  sales: "Sales by segment",
  collections: "Collections",
  distance: "Distance travelled",
  onboarding: "New customers",
  oils: "Oils — by segment",
  backlog: "Order backlog",
  ordered: "Ordered, not invoiced",
  customers: "Customer analytics",
  oilsSku: "Oils — by SKU (billed)",
  trend: "6-month trend (billed)",
  collectionsTrend: "6-month collections",
  cancelled: "Cancelled orders",
  returned: "Returned orders",
  productivityTrend: "Productivity %",
  customerProductivity: "Top & bottom customers",
  visitsTrend: "6-month visits",
  attendanceSummary: "Time & attendance",
};

/** Column counts for each report's loading shimmer (before its data arrives). */
export const REPORT_COLUMNS: Record<ReportKey, number> = {
  sales: 9,
  collections: 4,
  distance: 3,
  onboarding: 2,
  oils: 6,
  backlog: 3,
  ordered: 3,
  customers: 8,
  oilsSku: 5,
  trend: 4,
  collectionsTrend: 2,
  cancelled: 9,
  returned: 9,
  productivityTrend: 7,
  customerProductivity: 3,
  visitsTrend: 8,
  attendanceSummary: 6,
};

/** Reports that have NO brand dimension — when a brand is selected, they still
 *  show all data (a "Not brand-specific" note is shown on the page). */
export const NON_BRAND_KEYS = new Set<ReportKey>([
  "collections",
  "distance",
  "onboarding",
  "customers",
  "backlog",
  "trend",
  "collectionsTrend",
  "productivityTrend",
  "customerProductivity",
  "visitsTrend",
]);

/** All-time reports that ignore the selected date range. */
export const ALL_TIME_KEYS = new Set<ReportKey>(["customerProductivity"]);
/** Reports that are a CURRENT snapshot (ignore the date range). */
export const SNAPSHOT_KEYS = new Set<ReportKey>(["backlog", "ordered"]);

/** Chart shape per report — drives the context-aware chart shimmer:
 *  "bar" = horizontal / stacked bars, "series" = line/area over months,
 *  "none" = table-only (no chart). */
export type ChartKind = "bar" | "series" | "none";
export const CHART_KIND: Record<ReportKey, ChartKind> = {
  sales: "bar",
  collections: "bar",
  distance: "bar",
  onboarding: "bar",
  oils: "bar",
  backlog: "bar",
  ordered: "bar",
  customers: "bar",
  oilsSku: "bar",
  cancelled: "bar",
  returned: "bar",
  trend: "series",
  collectionsTrend: "series",
  productivityTrend: "series",
  visitsTrend: "series",
  customerProductivity: "none",
  attendanceSummary: "bar",
};

/** Table shape per report — drives the context-aware table shimmer.
 *  "matrix" = name + numeric columns · "grouped" = group headers + indented
 *  line rows · "wide" = a name+code lead cell + numeric columns. */
export type TableVariant = "matrix" | "grouped" | "wide";
export const TABLE_VARIANT: Record<ReportKey, TableVariant> = {
  sales: "matrix",
  collections: "matrix",
  distance: "matrix",
  onboarding: "matrix",
  oils: "grouped",
  backlog: "grouped",
  ordered: "grouped",
  customers: "wide",
  oilsSku: "wide",
  trend: "matrix",
  collectionsTrend: "matrix",
  cancelled: "matrix",
  returned: "matrix",
  productivityTrend: "matrix",
  customerProductivity: "grouped",
  visitsTrend: "matrix",
  attendanceSummary: "wide",
};
