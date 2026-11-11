"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet, errorMessage } from "@/lib/api-client";
import type { DashboardMetrics, MetricsActionConfig } from "./metrics-helpers";

/**
 * Live metrics query, polled every 60s. The server-rendered `initialMetrics`
 * seeds the first paint for the initial range (no redundant on-mount refetch); a
 * range change drops to `isPending` (no data for the new key) so the cards
 * shimmer rather than briefly show the previous period's numbers.
 */
export function useDashboardMetrics(
  actionConfig: MetricsActionConfig,
  range: { from: string; to: string },
  initialMetrics: DashboardMetrics,
) {
  const qs = useMemo(() => `?from=${range.from}&to=${range.to}`, [range]);
  const isInitialRange =
    range.from === initialMetrics.range.from && range.to === initialMetrics.range.to;
  const query = useQuery({
    queryKey: ["dashboard-metrics", range.from, range.to],
    queryFn: () => apiGet<DashboardMetrics>(actionConfig, `/dashboard/metrics${qs}`),
    initialData: isInitialRange ? initialMetrics : undefined,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  return {
    metrics: query.data ?? initialMetrics,
    loading: query.isFetching,
    isPending: query.isPending,
    error: query.error ? errorMessage(query.error, "Could not load metrics.") : null,
  };
}
