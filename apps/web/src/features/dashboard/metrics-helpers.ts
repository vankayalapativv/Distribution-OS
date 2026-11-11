/**
 * Types, date-range presets, and bespoke formatters for the live metric cards +
 * drill-down dialogs. Shared display formatters (rupees/time/day-month) come from
 * `@/lib/format`; only the dashboard-specific helpers live here.
 */
import { formatDayMonth } from "@/lib/format";
import type { ActionConfig } from "@/lib/api-client";

/** `{ apiBaseUrl, authToken }` — structurally identical to the shared ActionConfig. */
export type MetricsActionConfig = ActionConfig;

export interface DashboardMetrics {
  range: { from: string; to: string };
  activeExecutives: { live: number; total: number };
  visits: number;
  productiveVisits: number;
  sales: { litres: number; orders: number };
  orderedOils: { litres: number; orders: number };
  /** Per-brand ordered oil (litres net of returns + distinct orders), biggest
   *  first — one entry per oil brand with orders in the period (dynamic). */
  oilsByBrand: { brand: string; litres: number; orders: number }[];
  collections: { total: number; verified: number; pendingCount: number; count: number };
}

export type MetricKey =
  | "executives"
  | "visits"
  | "productive"
  | "productivity"
  | "ordered"
  | "litres"
  | "collections";

export interface AgentRow {
  agentId: string;
  agentName: string;
  // executives
  live?: boolean;
  lastPingAt?: string | null;
  sessionStartedAt?: string | null;
  // visits/productive
  visits?: number;
  productiveVisits?: number;
  avgDurationMinutes?: number | null;
  customers?: number;
  // sales
  litres?: number;
  orders?: number;
  // collections
  amount?: number;
  verified?: number;
  collections?: number;
}

export type CustomerRow = Record<string, unknown>;

export type Preset = "today" | "week" | "month" | "custom";

export const METRIC_TITLES: Record<MetricKey, string> = {
  executives: "Active Executives",
  visits: "Visits",
  productive: "Productive Visits",
  productivity: "Productivity",
  ordered: "Total Ordered Oils",
  litres: "Sold Oil",
  collections: "Collections",
};

/** Local `YYYY-MM-DD` (not UTC) — used to build the query range. */
export function isoDate(d: Date): string {
  return d.toLocaleDateString("en-CA");
}

/** `431 L` / `12.5 L` — bespoke litres-with-unit label used in the drill-down rows. */
export function litresLabel(n: number): string {
  return `${Number.isInteger(n) ? n : n.toFixed(1)} L`;
}

export function rangeLabel(from: string, to: string): string {
  return from === to
    ? formatDayMonth(from)
    : `${formatDayMonth(from)} – ${formatDayMonth(to)}`;
}

export function presetRange(preset: Preset): { from: string; to: string } {
  // Anchor to IST (the business timezone + the server/greeting basis), not the
  // browser's local clock — so an admin on a non-IST machine still gets the same
  // today/week/month window the server computes. `now`'s local fields now hold
  // the IST wall-clock, so isoDate (local en-CA) + getDay/getMonth read as IST.
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const to = isoDate(now);
  if (preset === "week") {
    // Current week's Monday → today (not a trailing 7 days, which would start in
    // the previous week). getDay(): Sun=0..Sat=6 → days since Monday.
    const start = new Date(now);
    const daysFromMonday = (start.getDay() + 6) % 7; // Mon=0, …, Sun=6
    start.setDate(start.getDate() - daysFromMonday);
    return { from: isoDate(start), to };
  }
  if (preset === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: isoDate(start), to };
  }
  return { from: to, to };
}
