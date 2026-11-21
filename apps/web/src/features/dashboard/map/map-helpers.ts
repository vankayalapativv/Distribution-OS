/** Colours + dues-band logic for the Dashboard OpenStreetMap section. The bucket
 *  colours mirror the Collection Dues card so the map reads as its geographic
 *  twin. Domain types live in ./map-types, staleness chips in ./map-chips; both
 *  are re-exported here so ./map-helpers stays the section's single import. */
import type { DuesBucketKey } from "./map-types";

export type { DuesBucketKey, MapCustomer, MapPosition, MapCheckin, MapRoute, MapActivity } from "./map-types";
export { orderChip, collectionChip, type ChipStyle } from "./map-chips";

/** One collection-dues band as served by /dashboard/map (mirrors the API's
 *  DuesBand) — its key is the ordinal as a string. */
export interface DuesBand {
  key: string;
  ordinal: number;
  fromDays: number;
  toDays: number | null;
  label: string;
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

/** SE live-position marker (green when pinging now, else muted). */
export const SE_LIVE_COLOR = "#16a34a"; // green-600
export const SE_STALE_COLOR = "#9ca3af"; // gray-400
/** Today's check-in marker. */
export const CHECKIN_COLOR = "#7c3aed"; // violet-600
/** SE day-route line. */
export const ROUTE_COLOR = "#2563eb"; // blue-600

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

/** Ramp colour for a bucket key (its band ordinal). Neutral slate when clear.
 *  Colour is purely ordinal, so it needs no band data. */
export function bucketColor(bucket: DuesBucketKey | null): string {
  if (bucket == null) return CLEAR_COLOR;
  const i = Number(bucket);
  if (!Number.isInteger(i) || i < 0) return CLEAR_COLOR;
  return BAND_RAMP[Math.min(i, BAND_RAMP.length - 1)];
}

/** ₹ with Indian grouping, no paise. */
export function rupees(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
