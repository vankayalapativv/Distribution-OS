import type { DashboardMetrics } from "../../lib/admin-dashboard";
import type { MetricKey } from "../../lib/admin-drill";
import type { IconName } from "../icon";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const num = (n: number) => n.toLocaleString("en-IN");
/** Litres with an optional single decimal (257 → "257", 257.7 → "257.7"). */
const fmtL = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export interface Tile {
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

/** productiveVisits ÷ visits as a whole percent (0 when no visits / no metrics). */
export function productivityPct(metrics: DashboardMetrics | null): number {
  return metrics && metrics.visits > 0
    ? Math.round((metrics.productiveVisits / metrics.visits) * 100)
    : 0;
}

/**
 * Build the KPI tiles: the five fixed cards (each tapping through to its drill via
 * `open`) followed by one display-only tile per oil brand with sales. Values are
 * undefined until `metrics` arrive, so the cards shimmer on first load.
 */
export function buildTiles(
  metrics: DashboardMetrics | null,
  open: (m: MetricKey) => (() => void) | undefined,
): Tile[] {
  const pct = productivityPct(metrics);
  const fixed: Tile[] = [
    { key: "executives", label: "Active Executives", sub: "live now",
      value: metrics ? `${metrics.activeExecutives.live}/${metrics.activeExecutives.total}` : undefined,
      icon: "people", fg: "#2563eb", badge: "bg-blue-50", onPress: open("executives") },
    { key: "productivity", label: "Productivity", subDynamic: true, value: metrics ? `${pct}%` : undefined,
      sub: metrics ? `${num(metrics.visits)} visits · ${num(metrics.productiveVisits)} productive` : undefined,
      icon: "speedometer", fg: "#059669", badge: "bg-emerald-50", onPress: open("productivity") },
    { key: "ordered", label: "Total Ordered Oils", subDynamic: true,
      value: metrics ? `${fmtL(metrics.orderedOils.litres)} L` : undefined,
      sub: metrics ? `${num(metrics.orderedOils.orders)} orders` : undefined,
      icon: "water", fg: "#d97706", badge: "bg-amber-50", onPress: open("ordered") },
    { key: "litres", label: "Sold Oil", subDynamic: true,
      value: metrics ? `${fmtL(metrics.sales.litres)} L` : undefined,
      sub: metrics ? `${num(metrics.sales.orders)} deliveries` : undefined,
      icon: "flask", fg: "#0284c7", badge: "bg-sky-50", onPress: open("litres") },
    { key: "collections", label: "Collections", subDynamic: true,
      value: metrics ? inr(metrics.collections.total) : undefined,
      sub: metrics ? `${num(metrics.collections.count)} entries` : undefined,
      icon: "cash", fg: "#0d9488", badge: "bg-teal-50", onPress: open("collections") },
  ];

  // One display-only tile per oil brand with sales (dynamic, biggest first).
  const brandTiles: Tile[] = (metrics?.oilsByBrand ?? []).map((b) => ({
    key: `brand:${b.brand}`, label: b.brand, value: `${fmtL(b.litres)} L`,
    sub: `${num(b.orders)} orders`, subDynamic: true, icon: "water", fg: "#4f46e5", badge: "bg-indigo-50",
  }));

  return [...fixed, ...brandTiles];
}

/** Chunk the tiles into rows of two for the grid. */
export function tileRows(tiles: Tile[]): Tile[][] {
  const rows: Tile[][] = [];
  for (let i = 0; i < tiles.length; i += 2) rows.push(tiles.slice(i, i + 2));
  return rows;
}
