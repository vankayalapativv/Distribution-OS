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

  const renderCard = (t: Tile, lone = false) => (
    <KpiCard
      key={t.key}
      label={t.label}
      value={t.value}
      sub={t.sub}
      subDynamic={t.subDynamic}
      accent={{ icon: t.icon, fg: t.fg, badge: t.badge }}
      onPress={t.onPress}
      // A lone trailing card gets `flexBasis: 0` so it stays exactly half width
      // (matching the empty spacer beside it) without out-growing from its
      // content-sized basis. It stays a direct row child, so its own `flex-1`
      // still sizes WIDTH (wrapping it in a View would make flex-1 size height
      // instead and collapse the card).
      style={lone ? { flexBasis: 0 } : undefined}
    />
  );

  return (
    <>
      {rows.map((row) =>
        row.length === 1 ? (
          <View key={row[0].key} className="flex-row gap-3">
            {renderCard(row[0], true)}
            <View className="flex-1" style={{ flexBasis: 0 }} />
          </View>
        ) : (
          <View key={row[0].key} className="flex-row gap-3">
            {row.map((t) => renderCard(t))}
          </View>
        ),
      )}

      <KpiDrillDialog metric={drill} range={range} onClose={() => setDrill(null)} />
    </>
  );
}
