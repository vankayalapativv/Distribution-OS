import { apiFetch } from "./api";
import { useAuth } from "./auth";

/**
 * Super Admin dashboard metrics — mirrors the web `/dashboard/metrics` payload
 * (services/dashboard-metrics). Both from/to default to IST today server-side,
 * so a no-arg call returns today's live metrics.
 */
export interface DashboardMetrics {
  range: { from: string; to: string };
  activeExecutives: { live: number; total: number };
  visits: number;
  productiveVisits: number;
  sales: { litres: number; orders: number };
  /** GROSS ordered oil litres incl. cancelled orders, pre-returns, by order date
   *  (matches the web "Total Ordered Oils" card). `orders` = order count. */
  orderedOils: { litres: number; orders: number };
  /** One entry per oil brand with sales (ordered litres net of returns), biggest
   *  first — drives the dynamic per-brand tiles (matches the web dashboard). */
  oilsByBrand: { brand: string; litres: number; orders: number }[];
  collections: { total: number; verified: number; pendingCount: number; count: number };
}

/** Metrics for a from–to range (yyyy-mm-dd); no range = IST today (server default). */
export async function fetchDashboardMetrics(from?: string, to?: string): Promise<DashboardMetrics> {
  const token = useAuth.getState().token;
  const q = from && to ? `?from=${from}&to=${to}` : "";
  return apiFetch<DashboardMetrics>(`/dashboard/metrics${q}`, { token });
}

/** Today in IST (yyyy-mm-dd) — matches the server's metrics default. */
export function istToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}
