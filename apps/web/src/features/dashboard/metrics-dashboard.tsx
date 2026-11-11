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
import { useState } from "react";
import dynamic from "next/dynamic";
import { withQueryClient } from "@/components/data-table/query-provider";
import type { DashboardMetrics, MetricsActionConfig } from "./metrics-helpers";
import { usePeriodRange } from "./use-period-range";
import { useDashboardMetrics } from "./use-dashboard-metrics";
import { MetricsPeriodSwitcher } from "./metrics-period-switcher";
import { MetricsCards } from "./metrics-cards";
import { useDrilldown } from "./use-drilldown";
import { DuesCard } from "./dues-card";
import { DashboardMapSection } from "./map/dashboard-map-section";
import { SkeletonCards } from "./dashboard-skeletons";

// The drill-down dialog pulls in framer-motion (via AnimatedSwap) + the two
// level views — a chunk the dashboard's initial load doesn't need, since the
// dialog only ever renders after the user opens a metric. Load it lazily and
// mount it only once a drill-down has been opened (kept mounted afterward so the
// close animation still plays), so framer-motion never ships to users who don't
// drill down.
const MetricsDrilldownDialog = dynamic(
  () => import("./metrics-drilldown-dialog").then((m) => m.MetricsDrilldownDialog),
  { ssr: false },
);

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
  // Mount the lazy dialog on first open and keep it mounted thereafter (so its
  // close transition still runs). Latching via set-state-during-render (React's
  // supported pattern for deriving state from a prior render) — no effect, no
  // extra commit. Users who never drill down never fetch its chunk.
  const [drilldownMounted, setDrilldownMounted] = useState(false);
  if (drill.metric && !drilldownMounted) setDrilldownMounted(true);

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

      {drilldownMounted ? (
        <MetricsDrilldownDialog
          metric={drill.metric}
          range={range}
          agents={drill.agents}
          agent={drill.agent}
          customerRows={drill.customerRows}
          error={drill.error}
          onOpenChange={(open) => {
            if (!open) drill.close();
          }}
          onBack={drill.back}
          onOpenAgent={drill.openAgent}
        />
      ) : null}
    </>
  );
}

/**
 * Provides a scoped TanStack Query client for the dashboard metric cards + the
 * nested analytics tables, then renders the dashboard. (Matches the list-view pattern.)
 */
export const MetricsDashboard = withQueryClient(MetricsDashboardInner);
