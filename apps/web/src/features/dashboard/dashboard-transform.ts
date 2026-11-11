import type { DashboardExperienceData } from "./dashboard-experience";

/** Shape returned by the role dashboard API (`/dashboard/{role}`). */
export interface ApiDashboard {
  metrics: { [key: string]: number | string };
  executivePerformance?: Array<{
    executiveName?: string;
    completedVisits?: number;
    productiveVisits?: number;
    salesValue?: number;
    collections?: number;
    gpsStatus?: string;
  }>;
}

export interface ApiSuccess<T> {
  success: boolean;
  data: T;
}

/** camelCase metric key → spaced, capitalised label ("salesValue" → "Sales Value"). */
export function humanizeMetricLabel(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (first) => first.toUpperCase());
}

/** Map the raw API dashboard body to the view model the shell renders. Pure. */
export function mapDashboardData(data: ApiDashboard): DashboardExperienceData {
  return {
    metrics: Object.entries(data.metrics).map(([label, value]) => ({
      label: humanizeMetricLabel(label),
      value: String(value),
    })),
    executivePerformance: (data.executivePerformance ?? []).map((row) => ({
      name: row.executiveName ?? "Unknown Executive",
      visits: row.completedVisits ?? 0,
      productiveVisits: row.productiveVisits ?? 0,
      salesValue: String(row.salesValue ?? 0),
      collections: String(row.collections ?? 0),
      gpsStatus: row.gpsStatus ?? "unknown",
    })),
  };
}
