import { useState } from "react";
import { View } from "react-native";
import type { DashboardMetrics } from "../../lib/admin-dashboard";
import type { MetricKey } from "../../lib/admin-drill";
import type { IconName } from "../icon";
import { KpiCard } from "./kpi-card";
import { KpiDrillDialog } from "./kpi-drill-dialog";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const num = (n: number) => n.toLocaleString("en-IN");
/** Litres with an optional single decimal (257 → "257", 257.7 → "257.7"). */
const fmtL = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

interface Tile {
  key: string;
  label: string;
  /** undefined while metrics load → the value shimmers. */
  value?: string;
  sub?: string;
  subDynamic?: boolean;
  icon: IconName;
  fg: string;
  badge: string;
  onPress?: () => void;
}

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

  const pct = metrics && metrics.visits > 0 ? Math.round((metrics.productiveVisits / metrics.visits) * 100) : 0;

  const fixed: Tile[] = [
    {
      key: "executives",
      label: "Active Executives",
      value: metrics ? `${metrics.activeExecutives.live}/${metrics.activeExecutives.total}` : undefined,
      sub: "live now",
      icon: "people",
      fg: "#2563eb",
      badge: "bg-blue-50",
      onPress: open("executives"),
    },
    {
      key: "productivity",
      label: "Productivity",
      value: metrics ? `${pct}%` : undefined,
      sub: metrics ? `${num(metrics.visits)} visits · ${num(metrics.productiveVisits)} productive` : undefined,
      subDynamic: true,
      icon: "speedometer",
      fg: "#059669",
      badge: "bg-emerald-50",
      onPress: open("productivity"),
    },
    {
      key: "ordered",
      label: "Total Ordered Oils",
      value: metrics ? `${fmtL(metrics.orderedOils.litres)} L` : undefined,
      sub: metrics ? `${num(metrics.orderedOils.orders)} orders` : undefined,
      subDynamic: true,
      icon: "water",
      fg: "#d97706",
      badge: "bg-amber-50",
      onPress: open("ordered"),
    },
    {
      key: "litres",
      label: "Sold Oil",
      value: metrics ? `${fmtL(metrics.sales.litres)} L` : undefined,
      sub: metrics ? `${num(metrics.sales.orders)} deliveries` : undefined,
      subDynamic: true,
      icon: "flask",
      fg: "#0284c7",
      badge: "bg-sky-50",
      onPress: open("litres"),
    },
    {
      key: "collections",
      label: "Collections",
      value: metrics ? inr(metrics.collections.total) : undefined,
      sub: metrics ? `${num(metrics.collections.count)} entries` : undefined,
      subDynamic: true,
      icon: "cash",
      fg: "#0d9488",
      badge: "bg-teal-50",
      onPress: open("collections"),
    },
  ];

  // One display-only tile per oil brand with sales (dynamic, biggest first).
  const brandTiles: Tile[] = (metrics?.oilsByBrand ?? []).map((b) => ({
    key: `brand:${b.brand}`,
    label: b.brand,
    value: `${fmtL(b.litres)} L`,
    sub: `${num(b.orders)} orders`,
    subDynamic: true,
    icon: "water",
    fg: "#4f46e5",
    badge: "bg-indigo-50",
  }));

  const tiles = [...fixed, ...brandTiles];
  const rows: Tile[][] = [];
  for (let i = 0; i < tiles.length; i += 2) rows.push(tiles.slice(i, i + 2));

  return (
    <>
      {rows.map((row) => (
        <View key={row[0].key} className="flex-row gap-3">
          {row.map((t) => (
            <KpiCard
              key={t.key}
              label={t.label}
              value={t.value}
              sub={t.sub}
              subDynamic={t.subDynamic}
              accent={{ icon: t.icon, fg: t.fg, badge: t.badge }}
              onPress={t.onPress}
            />
          ))}
          {/* Keep a lone last card at half width instead of stretching full. */}
          {row.length === 1 ? <View className="flex-1" /> : null}
        </View>
      ))}

      <KpiDrillDialog metric={drill} range={range} onClose={() => setDrill(null)} />
    </>
  );
}
