"use client";

import { ChevronRight, Droplet } from "lucide-react";
import type { DashboardMetrics, MetricKey } from "./metrics-helpers";
import { STYLE, fmtL, needsAttention } from "./metrics-cards-config";
import { buildMetricCards } from "./metrics-cards-data";

// Rotating accents so several brand tiles read as distinct at a glance.
const BRAND_ACCENTS = [
  { icon: "text-indigo-500", border: "border-l-indigo-300" },
  { icon: "text-sky-500", border: "border-l-sky-300" },
  { icon: "text-violet-500", border: "border-l-violet-300" },
  { icon: "text-teal-600", border: "border-l-teal-300" },
  { icon: "text-amber-500", border: "border-l-amber-300" },
  { icon: "text-rose-500", border: "border-l-rose-300" },
];

export function MetricsCards({
  metrics,
  loading,
  onOpen,
}: {
  readonly metrics: DashboardMetrics;
  readonly loading: boolean;
  readonly onOpen: (metric: MetricKey) => void;
}) {
  const cards = buildMetricCards(metrics);

  return (
    <section
      aria-label="Dashboard metrics"
      className={`mb-7 grid grid-cols-2 gap-4 lg:grid-cols-3 ${loading ? "opacity-70" : ""}`}
    >
      {cards.map((card) => {
        const { icon: Icon, iconClass, accent } = STYLE[card.key];
        const attention = needsAttention(card.key, metrics);
        return (
          <button
            key={card.key}
            type="button"
            onClick={() => onOpen(card.key)}
            className={`group relative rounded-xl border border-l-4 border-border bg-white p-5 text-left shadow-sm transition-colors hover:border-primary ${
              attention ? "border-l-amber-400" : accent
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Icon size={14} className={attention ? "text-amber-500" : iconClass} aria-hidden="true" />
              <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
            </span>
            <p className="mt-1.5 text-3xl font-bold tabular-nums text-foreground">{card.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{card.subline}</p>
            <ChevronRight
              size={15}
              className="absolute right-4 top-4 text-slate-400 transition-colors group-hover:text-primary"
              aria-hidden="true"
            />
          </button>
        );
      })}

      {/* One tile per oil brand with orders (dynamic, biggest first) — ordered
          litres net of returns. Non-interactive; the aggregate Sold Oil / Total
          Ordered Oils cards above carry the combined totals. */}
      {(metrics.oilsByBrand ?? []).map((b, i) => {
        const accent = BRAND_ACCENTS[i % BRAND_ACCENTS.length];
        return (
          <div
            key={`brand:${b.brand}:${i}`}
            className={`relative rounded-xl border border-l-4 border-border bg-white p-5 text-left shadow-sm ${accent.border}`}
          >
            <span className="flex items-center gap-1.5">
              <Droplet size={14} className={accent.icon} aria-hidden="true" />
              <span className="text-xs font-medium text-muted-foreground">{b.brand}</span>
            </span>
            <p className="mt-1.5 text-3xl font-bold tabular-nums text-foreground">
              {fmtL(b.litres)}
              <span className="text-base font-semibold"> L</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {b.orders} order{b.orders === 1 ? "" : "s"} · net of returns
            </p>
          </div>
        );
      })}
    </section>
  );
}
