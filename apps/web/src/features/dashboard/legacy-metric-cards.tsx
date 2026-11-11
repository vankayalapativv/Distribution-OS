import type { DashboardMetric } from "./dashboard-experience-types";

/** Legacy metric card grid (ACCOUNTANT) — plain value + label tiles, shown when
 *  the role has no live metrics dashboard. */
export function LegacyMetricCards({ metrics }: { readonly metrics: DashboardMetric[] }) {
  return (
    <section
      aria-label="Dashboard metrics"
      className="mb-7 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
    >
      {metrics.map((metric) => (
        <div key={metric.label} className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="text-3xl font-bold text-foreground">{metric.value}</p>
          <p className="mt-1.5 text-xs font-medium text-muted-foreground">{metric.label}</p>
        </div>
      ))}
    </section>
  );
}
