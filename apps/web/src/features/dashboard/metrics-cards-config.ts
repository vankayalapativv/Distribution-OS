import {
  Droplet,
  Droplets,
  Gauge,
  IndianRupee,
  MapPin,
  SquareCheckBig,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { DashboardMetrics, MetricKey } from "./metrics-helpers";

export interface MetricCard {
  key: MetricKey;
  label: React.ReactNode;
  value: React.ReactNode;
  subline: string;
}

/** Litres with an optional single decimal (e.g. 257 → "257", 257.7 → "257.7"). */
export const fmtL = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/**
 * Per-metric icon + subtle left-accent hue, so the six cards read as distinct
 * types at a glance instead of six identical tiles. `attention` overrides the
 * accent to amber — the tunable triage rules live in {@link needsAttention}.
 */
export const STYLE: Record<MetricKey, { icon: LucideIcon; iconClass: string; accent: string }> = {
  executives: { icon: Users, iconClass: "text-blue-500", accent: "border-l-blue-300" },
  visits: { icon: MapPin, iconClass: "text-violet-500", accent: "border-l-violet-300" },
  productive: { icon: SquareCheckBig, iconClass: "text-emerald-500", accent: "border-l-emerald-300" },
  productivity: { icon: Gauge, iconClass: "text-green-600", accent: "border-l-green-300" },
  ordered: { icon: Droplets, iconClass: "text-indigo-500", accent: "border-l-indigo-300" },
  litres: { icon: Droplet, iconClass: "text-sky-500", accent: "border-l-sky-300" },
  collections: { icon: IndianRupee, iconClass: "text-teal-600", accent: "border-l-teal-300" },
};

/**
 * Default triage rules (tune later): a card turns amber when it likely needs a
 * human to look. Collections → any pending verification; Executives → nobody
 * live on the ground while the team exists.
 */
export function needsAttention(key: MetricKey, m: DashboardMetrics): boolean {
  if (key === "collections") return m.collections.pendingCount > 0;
  if (key === "executives") return m.activeExecutives.live === 0 && m.activeExecutives.total > 0;
  return false;
}

/** Overall productivity = productive ÷ total visits (0 when no visits yet). */
export function productivityPct(m: DashboardMetrics): number {
  return m.visits > 0 ? Math.round((m.productiveVisits / m.visits) * 100) : 0;
}
