"use client";

/** Dispatches a drilled-in report's fetched slice to its chart (shown above the
 *  table). Big reports (customers, billed SKU) chart the top 10 by volume; the
 *  table still lists everything. Oils-only (no bearings). */
import type { ReactNode } from "react";
import { litres, rupees } from "@/lib/format";
import { SimpleBarChart } from "./reports-chart-kit";
import { SegmentBarChart } from "./reports-chart-segment";
import { CollectionsTrendChart, TrendChart } from "./reports-chart-trend";
import { ProductivityLineChart, VisitsLineChart } from "./reports-chart-productivity";
import type { AdjustmentReport, ReportKey, ReportSlice } from "./reports-types";

const int = (n: number) => String(Math.round(n));
const km = (n: number) => `${n.toFixed(1)} km`;
const topN = <T,>(arr: T[], val: (t: T) => number, n = 10): T[] =>
  [...arr].sort((a, b) => val(b) - val(a)).slice(0, n);

/** Cancelled/Returned → stacked oil-litres bar (combined partial+full) by exec × segment. */
function adjustmentChart(report: AdjustmentReport) {
  const rows = report.oils.map((r) => ({
    name: r.name,
    segments: Object.fromEntries(report.segments.map((s) => [s, (r.partial[s] ?? 0) + (r.full[s] ?? 0)])),
  }));
  return <SegmentBarChart segments={report.segments} rows={rows} fmt={litres} />;
}

/** Reports that have a chart (the drill-in shows a chart card above the table). */
export const CHARTED_KEYS = new Set<ReportKey>([
  "sales", "collections", "distance", "onboarding", "oils", "backlog", "ordered",
  "customers", "oilsSku", "trend", "collectionsTrend", "cancelled", "returned",
  "productivityTrend", "visitsTrend", "attendanceSummary",
]);

// One renderer per charted report key — a flat lookup instead of a long switch
// (SonarQube S3776). Each renders its chart, or null when the slice is absent.
const CHART_BY_KEY: Partial<Record<ReportKey, (slice: ReportSlice) => ReactNode>> = {
  sales: (s) => (s.sales ? <SegmentBarChart segments={s.sales.segments} rows={s.sales.rows} fmt={litres} /> : null),
  collections: (s) => (s.collections ? <SegmentBarChart segments={s.collections.segments} rows={s.collections.rows} fmt={rupees} /> : null),
  distance: (s) => (s.distance ? <SimpleBarChart data={s.distance.rows.map((r) => ({ label: r.name, value: r.km }))} seriesLabel="Distance" fmt={km} /> : null),
  onboarding: (s) => (s.onboarding ? <SimpleBarChart data={s.onboarding.rows.map((r) => ({ label: r.name, value: r.count }))} seriesLabel="New customers" fmt={int} /> : null),
  oils: (s) => (s.oils ? <SimpleBarChart data={s.oils.groups.map((g) => ({ label: g.segment, value: g.totalLitres }))} seriesLabel="Oils (L)" fmt={litres} /> : null),
  backlog: (s) => (s.backlog ? <SimpleBarChart data={s.backlog.groups.map((g) => ({ label: g.name, value: g.totalValue }))} seriesLabel="Backlog" fmt={rupees} /> : null),
  ordered: (s) => (s.orderedNotInvoiced ? <SimpleBarChart data={s.orderedNotInvoiced.groups.map((g) => ({ label: g.name, value: g.totalLitres }))} seriesLabel="Pending litres" fmt={litres} /> : null),
  customers: (s) => (s.customers ? <SimpleBarChart data={topN(s.customers.rows, (r) => r.litres).map((r) => ({ label: r.customerName, value: r.litres }))} seriesLabel="Oils (L)" fmt={litres} /> : null),
  oilsSku: (s) => (s.oilsSku ? <SimpleBarChart data={topN(s.oilsSku, (r) => r.litres).map((r) => ({ label: r.name, value: r.litres }))} seriesLabel="Litres" fmt={litres} /> : null),
  trend: (s) => (s.trend ? <TrendChart months={s.trend} /> : null),
  collectionsTrend: (s) => (s.collectionsTrend ? <CollectionsTrendChart months={s.collectionsTrend.months} /> : null),
  cancelled: (s) => (s.cancelled ? adjustmentChart(s.cancelled) : null),
  returned: (s) => (s.returned ? adjustmentChart(s.returned) : null),
  productivityTrend: (s) => (s.productivityTrend ? <ProductivityLineChart data={s.productivityTrend} /> : null),
  visitsTrend: (s) => (s.visitsTrend ? <VisitsLineChart data={s.visitsTrend} /> : null),
  attendanceSummary: (s) => (s.attendanceSummary ? <SimpleBarChart data={s.attendanceSummary.rows.map((r) => ({ label: r.name, value: r.attendancePct ?? 0 }))} seriesLabel="Attendance %" fmt={(n) => `${n}%`} /> : null),
  customerProductivity: () => null, // ranking table — no chart
};

export function ReportChart({ reportKey, slice }: Readonly<{ reportKey: ReportKey; slice: ReportSlice }>) {
  return CHART_BY_KEY[reportKey]?.(slice) ?? null;
}
