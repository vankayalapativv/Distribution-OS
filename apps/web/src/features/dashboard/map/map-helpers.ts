/** Types + colours for the Dashboard OpenStreetMap section. The bucket colours
 *  mirror the Collection Dues card so the map reads as its geographic twin. */

/** A customer's dues bucket is the enterprise band's key (its ordinal as a
 *  string, "0".."3"), or null when they have no outstanding. */
export type DuesBucketKey = string;

/** One collection-dues band as served by /dashboard/map (mirrors the API's
 *  DuesBand) — its key is the ordinal as a string. */
export interface DuesBand {
  key: string;
  ordinal: number;
  fromDays: number;
  toDays: number | null;
  label: string;
}

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

/** The fixed 4-step ageing ramp, by band ORDINAL (freshest → most overdue). This
 *  is a universal visual scale — only the band labels/ranges are per-enterprise —
 *  and matches the Collection Dues card's accents. */
export const BAND_RAMP = [
  "#10b981", // emerald-500 — band 0 (freshest)
  "#eab308", // yellow-500  — band 1
  "#f97316", // orange-500  — band 2
  "#f43f5e", // rose-500    — band 3 (most overdue)
];

/** Customers with no outstanding — a neutral slate pin. */
export const CLEAR_COLOR = "#94a3b8"; // slate-400

/** Resolved label/colour/order for an enterprise's dues bands, built once from
 *  the /dashboard/map `bands` and threaded into the dot popups + district table. */
export interface BandMeta {
  /** Band keys in ordinal order (for the district ageing table). */
  order: string[];
  /** Enterprise label for a bucket key; "No dues" for a clear (null) customer. */
  label: (key: DuesBucketKey | null) => string;
  /** Ramp colour for a bucket key; neutral slate for a clear customer. */
  color: (key: DuesBucketKey | null) => string;
}

/** Fallback bands (the defaults) when the map data hasn't supplied any yet. */
const DEFAULT_BANDS: DuesBand[] = [
  { key: "0", ordinal: 0, fromDays: 0, toDays: 30, label: "0–30 days" },
  { key: "1", ordinal: 1, fromDays: 31, toDays: 45, label: "31–45 days" },
  { key: "2", ordinal: 2, fromDays: 46, toDays: 60, label: "46–60 days" },
  { key: "3", ordinal: 3, fromDays: 61, toDays: null, label: "61+ days" },
];

export function bandMeta(bands: DuesBand[] | null | undefined): BandMeta {
  const list = bands && bands.length ? bands : DEFAULT_BANDS;
  const byKey = new Map(list.map((b) => [b.key, b]));
  return {
    order: list.map((b) => b.key),
    label: (key) => (key != null ? (byKey.get(key)?.label ?? key) : "No dues"),
    color: (key) => bucketColor(key),
  };
}
/** SE live-position marker (green when pinging now, else muted). */
export const SE_LIVE_COLOR = "#16a34a"; // green-600
export const SE_STALE_COLOR = "#9ca3af"; // gray-400
/** Today's check-in marker. */
export const CHECKIN_COLOR = "#7c3aed"; // violet-600
/** SE day-route line. */
export const ROUTE_COLOR = "#2563eb"; // blue-600

/** Ramp colour for a bucket key (its band ordinal). Neutral slate when clear.
 *  Colour is purely ordinal, so it needs no band data. */
export function bucketColor(bucket: DuesBucketKey | null): string {
  if (bucket == null) return CLEAR_COLOR;
  const i = Number(bucket);
  if (!Number.isInteger(i) || i < 0) return CLEAR_COLOR;
  return BAND_RAMP[Math.min(i, BAND_RAMP.length - 1)];
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
