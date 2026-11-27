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
          // The wrapper MUST be `flex-row`: the card's `flex-1` is
          // flex-basis:0, so in a column context it would grow along the
          // vertical axis and collapse the card's height to 0 (basis 0, no
          // free space) — visible after a re-layout like pull-to-refresh. A
          // flex-row wrapper puts the card in the SAME horizontal-main-axis
          // context as a paired row, so flex-1 fills the 48% width and the
          // height stays content-sized, exactly like the left card of a pair.
          <View key={row[0].key} className="flex-row" style={{ width: "48%" }}>
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
