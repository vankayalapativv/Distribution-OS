/** Types + colours for the Dashboard OpenStreetMap section. The bucket colours
 *  mirror the Collection Dues card so the map reads as its geographic twin. */

export type DuesBucketKey = "0_30" | "30_45" | "45_60" | "60_plus";

export interface MapCustomer {
  id: string;
  name: string;
  code: string;
  city: string | null;
  lat: number;
  lng: number;
  executiveId: string | null;
  executiveName: string | null;
  outstanding: number;
  ageDays: number | null;
  bucket: DuesBucketKey | null;
  /** Days since the most recent non-cancelled order (any salesperson), or null. */
  lastOrderDays: number | null;
  /** Days since the most recent non-rejected collection (any salesperson), or null. */
  lastCollectionDays: number | null;
  /** Placed ≥1 order OR made ≥1 collection in the last 30 days. */
  active: boolean;
}

export interface MapPosition {
  userId: string;
  name: string;
  lat: number;
  lng: number;
  recordedAt: string | null;
  live: boolean;
}
export interface MapCheckin {
  visitId: string;
  customerId: string;
  customerName: string;
  lat: number;
  lng: number;
  executiveName: string | null;
  at: string | null;
  type: string;
}
export interface MapRoute {
  userId: string;
  name: string;
  points: { lat: number; lng: number }[];
}
export interface MapActivity {
  positions: MapPosition[];
  checkins: MapCheckin[];
  routes: MapRoute[];
}

/** Aging bucket → { label, colour } — colours match dues-helpers' accents. */
export const BUCKET_META: Record<DuesBucketKey, { label: string; color: string }> = {
  "0_30": { label: "0–30 days", color: "#10b981" }, // emerald-500
  "30_45": { label: "31–45 days", color: "#eab308" }, // yellow-500
  "45_60": { label: "46–60 days", color: "#f97316" }, // orange-500
  "60_plus": { label: "61+ days", color: "#f43f5e" }, // rose-500
};

/** Customers with no outstanding — a neutral slate pin. */
export const CLEAR_COLOR = "#94a3b8"; // slate-400
/** SE live-position marker (green when pinging now, else muted). */
export const SE_LIVE_COLOR = "#16a34a"; // green-600
export const SE_STALE_COLOR = "#9ca3af"; // gray-400
/** Today's check-in marker. */
export const CHECKIN_COLOR = "#7c3aed"; // violet-600
/** SE day-route line. */
export const ROUTE_COLOR = "#2563eb"; // blue-600

export function bucketColor(bucket: DuesBucketKey | null): string {
  return bucket ? BUCKET_META[bucket].color : CLEAR_COLOR;
}
export function bucketLabel(bucket: DuesBucketKey | null): string {
  return bucket ? BUCKET_META[bucket].label : "No dues";
}

/** A small staleness "pill": label + text/background colour. */
export interface ChipStyle {
  label: string;
  fg: string;
  bg: string;
}
const CHIP_TONE = {
  green: { fg: "#15803d", bg: "#dcfce7" }, // green-700 on green-100
  orange: { fg: "#c2410c", bg: "#ffedd5" }, // orange-700 on orange-100
  red: { fg: "#b91c1c", bg: "#fee2e2" }, // red-700 on red-100
} as const;

function agoLabel(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

/** Last-order chip: green ≤21 days, orange 22–30, red 31+; red "No orders yet" if never. */
export function orderChip(days: number | null): ChipStyle {
  if (days == null) return { label: "No orders yet", ...CHIP_TONE.red };
  let tone: (typeof CHIP_TONE)[keyof typeof CHIP_TONE] = CHIP_TONE.red;
  if (days <= 21) tone = CHIP_TONE.green;
  else if (days <= 30) tone = CHIP_TONE.orange;
  return { label: `Last order ${agoLabel(days)}`, ...tone };
}

/** Last-collection chip: green ≤7 days, orange 8–14, red 15+; red "No collections yet" if never. */
export function collectionChip(days: number | null): ChipStyle {
  if (days == null) return { label: "No collections yet", ...CHIP_TONE.red };
  let tone: (typeof CHIP_TONE)[keyof typeof CHIP_TONE] = CHIP_TONE.red;
  if (days <= 7) tone = CHIP_TONE.green;
  else if (days <= 14) tone = CHIP_TONE.orange;
  return { label: `Last collection ${agoLabel(days)}`, ...tone };
}

/** ₹ with Indian grouping, no paise. */
export function rupees(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
