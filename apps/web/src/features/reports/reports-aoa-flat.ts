/** Array-of-arrays builders for the flat reports (header row + body rows).
 *  Consumed by the per-report Excel/PDF export (reports-download.ts). */
import type {
  CollectionRow,
  CustomerReportRow,
  DistanceRow,
  OnboardingRow,
  SalesRow,
  SkuReportRow,
  TrendMonth,
} from "./reports-types";

export type Aoa = (string | number)[][];

export function segmentAoa(segments: string[], rows: (SalesRow | CollectionRow)[]): Aoa {
  return [
    ["Sales executive", ...segments, "Total"],
    ...rows.map((r) => [r.name, ...segments.map((s) => r.segments[s] ?? 0), r.total]),
  ];
}

export function distanceAoa(rows: DistanceRow[]): Aoa {
  return [["Name", "Role", "Distance (km)"], ...rows.map((r) => [r.name, r.role, r.km])];
}

export function onboardingAoa(rows: OnboardingRow[]): Aoa {
  return [["Sales executive", "New customers"], ...rows.map((r) => [r.name, r.count])];
}

export function oilsSkuAoa(rows: SkuReportRow[]): Aoa {
  return [
    ["Product", "Litres", "Invoices", "Customers", "Before GST"],
    ...rows.map((r) => [r.name, r.litres, r.invoices, r.customers, r.beforeGst]),
  ];
}

export function trendAoa(months: TrendMonth[]): Aoa {
  return [
    ["Month", "Oils (L)", "Before GST"],
    ...months.map((m) => [m.month, m.litres, m.beforeGst]),
  ];
}

export function customersAoa(rows: CustomerReportRow[]): Aoa {
  return [
    ["Customer", "Code", "Sales executive", "Oils (L)", "Orders", "Collected", "Pending", "Last order"],
    ...rows.map((r) => [
      r.customerName,
      r.customerCode ?? "",
      r.salesExecutive ?? "",
      r.litres,
      r.orders,
      r.collected,
      r.pendingCollections,
      r.lastOrderDate ?? "",
    ]),
  ];
}
