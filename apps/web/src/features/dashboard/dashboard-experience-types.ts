export type WebDashboardRole = "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT";

export interface DashboardMetric {
  label: string;
  value: string;
}

export interface ExecutivePerformanceRow {
  name: string;
  visits: number;
  productiveVisits: number;
  salesValue: string;
  collections: string;
  gpsStatus: string;
}

export interface DashboardExperienceData {
  metrics: DashboardMetric[];
  executivePerformance: ExecutivePerformanceRow[];
}
