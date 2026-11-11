"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet, errorMessage } from "@/lib/api-client";
import { useUrlState } from "@/lib/use-url-state";
import {
  METRIC_TITLES,
  type AgentRow,
  type CustomerRow,
  type MetricKey,
  type MetricsActionConfig,
} from "./metrics-helpers";

/**
 * Two-level drill-down state (metric → agents → customers), driven by the URL so
 * the browser Back button re-opens the exact drill-down and a refresh/deep-link
 * restores it:
 *  - `?metric=<key>` opens the dialog (opening PUSHES a history entry → Back closes it).
 *  - `?agent=<id>` opens the second (customers) level (also a push).
 * The data is fetched reactively with TanStack Query keyed on the URL params +
 * range, so restoring the URL re-fetches automatically (no manual effects).
 */
export function useDrilldown(actionConfig: MetricsActionConfig, range: { from: string; to: string }) {
  const { get, set } = useUrlState();
  const rawMetric = get("metric");
  const metric: MetricKey | null = rawMetric && rawMetric in METRIC_TITLES ? (rawMetric as MetricKey) : null;
  const agentId = get("agent") || null;
  const qs = `?from=${range.from}&to=${range.to}`;

  const agentsQ = useQuery({
    queryKey: ["drilldown-agents", metric, range.from, range.to],
    queryFn: () =>
      apiGet<{ agents: AgentRow[] }>(actionConfig, `/dashboard/metrics/${metric}/agents${qs}`).then((d) => d.agents),
    enabled: metric !== null,
  });
  const agents = agentsQ.data ?? null;
  const agent = agentId && agents ? agents.find((a) => a.agentId === agentId) ?? null : null;

  const customersQ = useQuery({
    queryKey: ["drilldown-customers", metric, agentId, range.from, range.to],
    queryFn: () =>
      apiGet<{ rows: CustomerRow[] }>(
        actionConfig,
        `/dashboard/metrics/${metric}/agents/${agentId}/customers${qs}`,
      ).then((d) => d.rows),
    enabled: metric !== null && agentId !== null,
  });
  const customerRows = customersQ.data ?? null;

  const err = agentsQ.error ?? customersQ.error;
  const error = err ? errorMessage(err, "Could not load details.") : null;

  return {
    metric,
    agents,
    agent,
    customerRows,
    error,
    // Opening a level PUSHES so Back closes/steps it; opening a new metric drops
    // any agent selection.
    openMetric: (next: MetricKey) => set({ metric: next, agent: null }, "push"),
    openAgent: (row: AgentRow) => set({ agent: row.agentId }, "push"),
    // In-dialog navigation uses replace (the browser Back button pops the push).
    back: () => set({ agent: null }),
    close: () => set({ metric: null, agent: null }),
  };
}
