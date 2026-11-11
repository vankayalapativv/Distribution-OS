import { apiFetch } from "./api";
import { useAuth } from "./auth";

/** The drillable SA KPIs (mirror the web dashboard's fixed cards + API MetricKey
 *  set). Visits/Productive are folded into Productivity; Bearings is gone. */
export type MetricKey =
  | "executives"
  | "productivity"
  | "ordered"
  | "litres"
  | "collections";

/** One executive's contribution to a metric. Fields are metric-specific, so all
 *  are optional; METRIC_META knows which to read for each metric. */
export interface AgentRow {
  agentId: string;
  agentName: string;
  live?: boolean;
  visits?: number;
  productiveVisits?: number;
  customers?: number;
  litres?: number;
  orders?: number;
  amount?: number;
  collections?: number;
}

const num = (n = 0) => Math.round(n).toLocaleString("en-IN");
const inr = (n = 0) => `₹${num(n)}`;

export interface DrillRow {
  value: string;
  sub?: string;
  tone?: "live" | "muted";
}

/** Per-metric dialog title + how to render each executive row. */
export const METRIC_META: Record<
  MetricKey,
  { title: string; row: (r: AgentRow) => DrillRow }
> = {
  executives: {
    title: "Active Executives",
    row: (r) => ({
      value: r.live ? "Live" : "Offline",
      sub: `${num(r.visits)} visits`,
      tone: r.live ? "live" : "muted",
    }),
  },
  productivity: {
    // Value is the productive/total count; the row renders the % as a colour pill.
    title: "Productivity",
    row: (r) => ({ value: `${num(r.productiveVisits)}/${num(r.visits)}`, sub: `${num(r.customers)} customers` }),
  },
  ordered: {
    title: "Total Ordered Oils",
    row: (r) => ({ value: `${num(r.litres)} L`, sub: `${num(r.orders)} orders` }),
  },
  litres: {
    title: "Sold Oil",
    row: (r) => ({ value: `${num(r.litres)} L`, sub: `${num(r.orders)} deliveries` }),
  },
  collections: {
    title: "Collections",
    row: (r) => ({ value: inr(r.amount), sub: `${num(r.collections)} entries` }),
  },
};

/** Level-1 drill: each executive's contribution to `metric` for the range. */
export async function fetchMetricAgents(
  metric: MetricKey,
  from: string,
  to: string,
): Promise<AgentRow[]> {
  const token = useAuth.getState().token;
  const data = await apiFetch<{ agents: AgentRow[] }>(
    `/dashboard/metrics/${metric}/agents?from=${from}&to=${to}`,
    { token },
  );
  return data.agents;
}
