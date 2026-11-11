import { rupeesExact } from "@/lib/format";
import { productivityColor } from "@/lib/productivity";
import type { DashboardMetrics } from "./metrics-helpers";
import { fmtL, productivityPct, type MetricCard } from "./metrics-cards-config";

/** The live-metric cards' label/value/subline content, derived from metrics.
 *  Visits + Productive-visits are folded into the single Productivity card;
 *  the per-brand oil cards are handled by the renderer. */
export function buildMetricCards(metrics: DashboardMetrics): MetricCard[] {
  const pct = productivityPct(metrics);
  const tone = productivityColor(pct);
  return [
    {
      key: "executives",
      label: (
        <span className="inline-flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${metrics.activeExecutives.live > 0 ? "bg-green-500" : "bg-amber-500"}`} />
          <span>Active Executives</span>
        </span>
      ),
      value: (
        <>
          {metrics.activeExecutives.live}
          <span className="text-base font-semibold text-muted-foreground"> / {metrics.activeExecutives.total}</span>
        </>
      ),
      subline: "day on · GPS alive",
    },
    {
      key: "productivity",
      label: "Productivity",
      value: (
        <span className="inline-flex items-baseline rounded-lg px-2 py-0.5" style={{ backgroundColor: tone.bg, color: tone.fg }}>
          {pct}
          <span className="text-base font-semibold">%</span>
        </span>
      ),
      subline: `${metrics.visits} visit${metrics.visits === 1 ? "" : "s"} · ${metrics.productiveVisits} productive`,
    },
    {
      key: "ordered",
      label: "Total Ordered Oils",
      value: (<>{fmtL(metrics.orderedOils.litres)}<span className="text-base font-semibold"> L</span></>),
      subline: `${metrics.orderedOils.orders} order${metrics.orderedOils.orders === 1 ? "" : "s"} · incl. cancelled`,
    },
    {
      key: "litres",
      label: "Sold Oil",
      value: (<>{fmtL(metrics.sales.litres)}<span className="text-base font-semibold"> L</span></>),
      subline: `${metrics.sales.orders} deliver${metrics.sales.orders === 1 ? "y" : "ies"} · net of returns`,
    },
    {
      key: "collections",
      label: "Collections",
      value: rupeesExact(metrics.collections.total),
      subline: `${rupeesExact(metrics.collections.verified)} verified · ${metrics.collections.pendingCount} pending`,
    },
  ];
}
