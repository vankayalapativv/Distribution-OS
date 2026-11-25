/**
 * Types, date-range presets, and bespoke formatters for the live metric cards +
 * drill-down dialogs. Shared display formatters (rupees/time/day-month) come from
 * `@/lib/format`; only the dashboard-specific helpers live here.
 */
import type { ActionConfig } from "@/lib/api-client";

export { isoDate, rangeLabel, presetRange } from "./metrics-ranges";

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
  /** True when this agent is a Super Admin doing field work (badged apart from SEs). */
  isSuperAdmin?: boolean;
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

/** `431 L` / `12.5 L` — bespoke litres-with-unit label used in the drill-down rows. */
export function litresLabel(n: number): string {
  return `${Number.isInteger(n) ? n : n.toFixed(1)} L`;
}
