"use client";

/**
 * Live metric cards + two-level drill-down dialogs for the Super-Admin and
 * Manager dashboards (2026-07-18). Data comes from /dashboard/metrics* —
 * computed live from visits/orders/collections/GPS, not the legacy
 * daily_executive_performance table.
 *
 * This file is the shell: it owns the period range + the live metrics query,
 * then composes the period switcher, metric cards, analytics tables, and the
 * drill-down dialog.
 */
import { withQueryClient } from "@/components/data-table/query-provider";
import type { DashboardMetrics, MetricsActionConfig } from "./metrics-helpers";
import { usePeriodRange } from "./use-period-range";
import { useDashboardMetrics } from "./use-dashboard-metrics";
import { MetricsPeriodSwitcher } from "./metrics-period-switcher";
import { MetricsCards } from "./metrics-cards";
import { useDrilldown } from "./use-drilldown";
import { MetricsDrilldownMount } from "./metrics-drilldown-mount";
import { DuesCard } from "./dues-card";
import { DashboardMapSection } from "./map/dashboard-map-section";
import { SkeletonCards } from "./dashboard-skeletons";

export type { DashboardMetrics, MetricsActionConfig } from "./metrics-helpers";

// The product/SKU analytics tables moved to the Reports page (as report cards)
// on 2026-08-26 — the dashboard now shows the metric cards + drill-downs only.

function MetricsDashboardInner({
  actionConfig,
  initialMetrics,
}: Readonly<{
  actionConfig: MetricsActionConfig;
  initialMetrics: DashboardMetrics;
}>) {
  const period = usePeriodRange(initialMetrics.range);
  const { range } = period;
  const { metrics, loading, isPending, error } = useDashboardMetrics(
    actionConfig,
    range,
    initialMetrics,
  );
  const drill = useDrilldown(actionConfig, range);

  return (
    <>
      <MetricsPeriodSwitcher
        preset={period.preset}
        range={range}
        calOpen={period.calOpen}
        calRange={period.calRange}
        onPreset={period.applyPreset}
        onCalOpenChange={period.setCalOpen}
        onCalendar={period.applyCalendar}
      />

      {error ? (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {isPending ? (
        <SkeletonCards />
      ) : (
        <MetricsCards metrics={metrics} loading={loading} onOpen={drill.openMetric} />
      )}

      <DuesCard actionConfig={actionConfig} />

      <DashboardMapSection actionConfig={actionConfig} />

      <MetricsDrilldownMount drill={drill} range={range} />
    </>
  );
}

/**
 * Provides a scoped TanStack Query client for the dashboard metric cards + the
 * nested analytics tables, then renders the dashboard. (Matches the list-view pattern.)
 */
export const MetricsDashboard = withQueryClient(MetricsDashboardInner);
