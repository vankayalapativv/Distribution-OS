/** AoA builders for the grouped reports + the `reportAoa(key, slice)` dispatcher
 *  that turns any fetched slice into export rows. */
import {
  customersAoa,
  distanceAoa,
  oilsSkuAoa,
  onboardingAoa,
  segmentAoa,
  trendAoa,
  type Aoa,
} from "./reports-aoa-flat";
import type {
  AdjustmentReport,
  AttendanceSummary,
  BacklogGroup,
  CollectionTrendMonth,
  CustomerProductivity,
  OilSegmentGroup,
  OrderedGroup,
  ProductivityTrend,
  ReportKey,
  ReportSlice,
  VisitsTrend,
} from "./reports-types";

function oilsAoa(groups: OilSegmentGroup[]): Aoa {
  const rows: Aoa = [["Segment", "Product", "Litres", "Qty", "Orders", "Customers", "Share %"]];
  for (const g of groups) {
    rows.push([g.segment, "— segment total —", g.totalLitres, "", "", "", ""]);
    for (const p of g.products)
      rows.push([g.segment, p.product, p.litres, p.quantity, p.orders, p.customers, p.share]);
  }
  return rows;
}

function backlogAoa(b: { groups: BacklogGroup[]; totalValue: number; totalCount: number }): Aoa {
  const rows: Aoa = [["Sales executive", "Invoice", "Customer", "Invoice date", "Value"]];
  for (const g of b.groups)
    for (const inv of g.invoices)
      rows.push([g.name, inv.invoiceNo, inv.customer, inv.invoiceDate, inv.value]);
  rows.push([`Total · ${b.totalCount} invoices`, "", "", "", b.totalValue]);
  return rows;
}

function orderedAoa(o: { groups: OrderedGroup[]; totalLitres: number; totalCount: number }): Aoa {
  const rows: Aoa = [["Sales executive", "Order", "Customer", "Pending litres"]];
  for (const g of o.groups)
    for (const ord of g.orders) rows.push([g.name, ord.orderCode, ord.customer, ord.remainingLitres]);
  rows.push([`Total · ${o.totalCount} orders`, "", "", o.totalLitres]);
  return rows;
}

function collectionsTrendAoa(months: CollectionTrendMonth[]): Aoa {
  const rows: Aoa = [["Month", "Collected"]];
  for (const m of months) rows.push([m.month, m.total]);
  return rows;
}

/** Cancelled / Returned — oils by executive × segment (Partially / Fully). */
function adjustmentAoa(report: AdjustmentReport): Aoa {
  const rows: Aoa = [["Sales executive", "Split", ...report.segments, "Total (L)", "% ordered"]];
  for (const r of report.oils) {
    rows.push([r.name, "Partially", ...report.segments.map((s) => r.partial[s] ?? 0), r.partialTotal, ""]);
    rows.push(["", "Fully", ...report.segments.map((s) => r.full[s] ?? 0), r.fullTotal, ""]);
    rows.push(["", "Total", ...report.segments.map((s) => (r.partial[s] ?? 0) + (r.full[s] ?? 0)), r.total, r.percent]);
  }
  return rows;
}

function productivityAoa(data: ProductivityTrend): Aoa {
  const rows: Aoa = [["Sales executive", ...data.months]];
  for (const r of data.rows) {
    const byMonth = new Map(r.points.map((p) => [p.month, p.pct]));
    rows.push([r.name, ...data.months.map((m) => byMonth.get(m) ?? "")]);
  }
  return rows;
}

function visitsAoa(data: VisitsTrend): Aoa {
  const rows: Aoa = [["Sales executive", ...data.months, "Total"]];
  for (const r of data.rows) {
    const byMonth = new Map(r.points.map((p) => [p.month, p.total]));
    rows.push([r.name, ...data.months.map((m) => byMonth.get(m) ?? 0), r.total]);
  }
  rows.push(["Total", ...data.months.map((m) => data.totals.find((t) => t.month === m)?.total ?? 0), data.grandTotal]);
  return rows;
}

function customerProductivityAoa(data: CustomerProductivity): Aoa {
  const rows: Aoa = [["Sales executive", "Rank", "Highest customer", "Highest %", "Lowest customer", "Lowest %"]];
  for (const r of data.rows) {
    const n = Math.max(r.highest.length, r.lowest.length);
    for (let i = 0; i < n; i++) {
      const hi = r.highest[i];
      const lo = r.lowest[i];
      rows.push([i === 0 ? r.name : "", i + 1, hi?.customer ?? "", hi?.pct ?? "", lo?.customer ?? "", lo?.pct ?? ""]);
    }
  }
  return rows;
}

function attendanceAoa(a: AttendanceSummary): Aoa {
  const rows: Aoa = [["Person", "Role", "Days present", "Working days", "Attendance %", "Avg hrs/day", "Avg visit (min)", "Avg visits/day"]];
  for (const r of a.rows) {
    rows.push([
      r.name,
      r.role === "LOGISTICS" ? "Logistics" : "Sales Exec",
      r.daysPresent,
      r.workingDays,
      r.attendancePct ?? "",
      r.avgHoursPerDay ?? "",
      r.avgVisitMinutes ?? "",
      r.avgVisitsPerDay ?? "",
    ]);
  }
  return rows;
}

/** Per-report AoA builder, each returning null when its slice is absent. */
const AOA_BUILDERS: Partial<Record<ReportKey, (s: ReportSlice) => Aoa | null>> = {
  sales: (s) => (s.sales ? segmentAoa(s.sales.segments, s.sales.rows) : null),
  collections: (s) => (s.collections ? segmentAoa(s.collections.segments, s.collections.rows) : null),
  distance: (s) => (s.distance ? distanceAoa(s.distance.rows) : null),
  onboarding: (s) => (s.onboarding ? onboardingAoa(s.onboarding.rows) : null),
  oils: (s) => (s.oils ? oilsAoa(s.oils.groups) : null),
  backlog: (s) => (s.backlog ? backlogAoa(s.backlog) : null),
  ordered: (s) => (s.orderedNotInvoiced ? orderedAoa(s.orderedNotInvoiced) : null),
  customers: (s) => (s.customers ? customersAoa(s.customers.rows) : null),
  oilsSku: (s) => (s.oilsSku ? oilsSkuAoa(s.oilsSku) : null),
  trend: (s) => (s.trend ? trendAoa(s.trend) : null),
  collectionsTrend: (s) => (s.collectionsTrend ? collectionsTrendAoa(s.collectionsTrend.months) : null),
  cancelled: (s) => (s.cancelled ? adjustmentAoa(s.cancelled) : null),
  returned: (s) => (s.returned ? adjustmentAoa(s.returned) : null),
  productivityTrend: (s) => (s.productivityTrend ? productivityAoa(s.productivityTrend) : null),
  customerProductivity: (s) => (s.customerProductivity ? customerProductivityAoa(s.customerProductivity) : null),
  visitsTrend: (s) => (s.visitsTrend ? visitsAoa(s.visitsTrend) : null),
  attendanceSummary: (s) => (s.attendanceSummary ? attendanceAoa(s.attendanceSummary) : null),
};

/** Turn a fetched slice into its export rows, or null if the slice is empty. */
export function reportAoa(key: ReportKey, s: ReportSlice): Aoa | null {
  return AOA_BUILDERS[key]?.(s) ?? null;
}
