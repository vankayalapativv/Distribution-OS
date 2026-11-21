"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { useDrilldown } from "./use-drilldown";

// The drill-down dialog pulls in framer-motion (via AnimatedSwap) + the two level
// views — a chunk the dashboard's initial load doesn't need, since the dialog only
// renders after the user opens a metric. Loaded lazily; mounted only once a
// drill-down has opened (kept mounted so the close animation still plays), so
// framer-motion never ships to users who don't drill down.
const MetricsDrilldownDialog = dynamic(
  () => import("./metrics-drilldown-dialog").then((m) => m.MetricsDrilldownDialog),
  { ssr: false },
);

/** Lazy-mounts the metrics drill-down dialog on first open via a
 *  set-state-during-render latch (no effect, no extra commit). */
export function MetricsDrilldownMount({
  drill,
  range,
}: Readonly<{
  drill: ReturnType<typeof useDrilldown>;
  range: { from: string; to: string };
}>) {
  const [mounted, setMounted] = useState(false);
  if (drill.metric && !mounted) setMounted(true);
  if (!mounted) return null;
  return (
    <MetricsDrilldownDialog
      metric={drill.metric}
      range={range}
      agents={drill.agents}
      agent={drill.agent}
      customerRows={drill.customerRows}
      error={drill.error}
      onOpenChange={(open) => { if (!open) drill.close(); }}
      onBack={drill.back}
      onOpenAgent={drill.openAgent}
    />
  );
}
