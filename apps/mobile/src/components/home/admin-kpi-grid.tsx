import { useState } from "react";
import { View } from "react-native";
import type { DashboardMetrics } from "../../lib/admin-dashboard";
import type { MetricKey } from "../../lib/admin-drill";
import { KpiCard } from "./kpi-card";
import { KpiDrillDialog } from "./kpi-drill-dialog";
import { buildTiles, tileRows, type Tile } from "./admin-kpi-grid-tiles";

/**
 * The admin KPI grid — mirrors the web dashboard's fixed cards (Active
 * Executives, Productivity, Total Ordered Oils, Sold Oil, Collections) followed
 * by one dynamic tile per oil brand with sales. Each fixed card taps through to a
 * per-executive drill-down; brand tiles are display-only (matches web). Values
 * shimmer until metrics arrive.
 */
export function AdminKpiGrid({
  metrics,
  range,
}: Readonly<{
  metrics: DashboardMetrics | null;
  range: { from: string; to: string };
}>) {
  const [drill, setDrill] = useState<MetricKey | null>(null);
  const open = (m: MetricKey) => (metrics ? () => setDrill(m) : undefined);

  const rows = tileRows(buildTiles(metrics, open));

  const renderCard = (t: Tile) => (
    <KpiCard
      key={t.key}
      label={t.label}
      value={t.value}
      sub={t.sub}
      subDynamic={t.subDynamic}
      accent={{ icon: t.icon, fg: t.fg, badge: t.badge }}
      onPress={t.onPress}
    />
  );

  return (
    <>
      {rows.map((row) =>
        row.length === 1 ? (
          // Lone last card → half width, matching a paired row's left card.
          // A plain `width: 48%` wrapper (no flex) is used instead of a flex
          // spacer: the card's own `flex-1` grows from a content basis, so a
          // flex approach makes it out-grow an empty spacer. The card's flex-1
          // just fills this fixed-width wrapper (width 48%, height stays content).
          <View key={row[0].key} style={{ width: "48%" }}>
            {renderCard(row[0])}
          </View>
        ) : (
          <View key={row[0].key} className="flex-row gap-3">
            {row.map(renderCard)}
          </View>
        ),
      )}

      <KpiDrillDialog metric={drill} range={range} onClose={() => setDrill(null)} />
    </>
  );
}
