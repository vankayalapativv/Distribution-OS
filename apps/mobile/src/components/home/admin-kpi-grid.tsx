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
          // Lone last card → exactly half width (matching a paired row's left
          // card). `flexBasis: 0` on both slots is required: a KpiCard's own
          // `flex-1` grows from a content-sized basis, so without it the single
          // card out-grows the empty spacer and renders too wide.
          <View key={row[0].key} className="flex-row gap-3">
            <View className="flex-1" style={{ flexBasis: 0 }}>
              {renderCard(row[0])}
            </View>
            <View className="flex-1" style={{ flexBasis: 0 }} />
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
