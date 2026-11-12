/**
 * Pure formatting for the tracking map overlays — the SAME rules/colours as the
 * web Live-Tracking + dashboard map, so a customer reads identically on both.
 * Kept import-light (one type import) so it's trivially unit-testable.
 */
import type { DuesBand, DuesBucketKey } from "./admin-tracking";

/** The fixed 4-step ageing ramp, by band ORDINAL (freshest → most overdue). A
 *  universal visual scale — only the band labels/ranges are per-enterprise — and
 *  the SAME colours as the web Live-Tracking map + Collection Dues card. Bands
 *  beyond the 4th clamp to the most-overdue colour. */
export const BAND_RAMP = [
  "#10b981", // emerald-500 — band 0 (freshest)
  "#eab308", // yellow-500  — band 1
  "#f97316", // orange-500  — band 2
  "#f43f5e", // rose-500    — band 3 (most overdue)
];
/** No-dues / clear pin colour (slate-400). */
export const CLEAR_COLOR = "#94a3b8";

/** Ramp colour for a bucket key (its band ordinal). Neutral slate when the
 *  customer is clear (null) or the key isn't a valid ordinal. Purely ordinal, so
 *  it needs no band data. */
export function bucketColor(bucket: DuesBucketKey | null): string {
  if (bucket == null) return CLEAR_COLOR;
  const i = Number(bucket);
  if (!Number.isInteger(i) || i < 0) return CLEAR_COLOR;
  return BAND_RAMP[Math.min(i, BAND_RAMP.length - 1)];
}

/** Enterprise label for a bucket key, resolved from the served bands ("No dues"
 *  when clear). Falls back to the key itself if the band list is missing it. */
export function bucketLabel(bucket: DuesBucketKey | null, bands?: DuesBand[]): string {
  if (bucket == null) return "No dues";
  const band = (bands ?? []).find((b) => b.key === bucket);
  return band?.label ?? bucket;
}

/** ₹ with Indian grouping, no paise (matches web `rupees`). */
export function rupees(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

/** A small staleness pill — text + fg/bg colours. */
export interface Chip {
  label: string;
  fg: string;
  bg: string;
}
const TONE = {
  green: { fg: "#15803d", bg: "#dcfce7" },
  orange: { fg: "#c2410c", bg: "#ffedd5" },
  red: { fg: "#b91c1c", bg: "#fee2e2" },
} as const;

function agoLabel(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

/** Last-order chip: green ≤21d, orange 22–30, red 31+; red "No orders yet" if never. */
export function orderChip(days: number | null): Chip {
  if (days == null) return { label: "No orders yet", ...TONE.red };
  let tone: Omit<Chip, "label"> = TONE.red;
  if (days <= 21) tone = TONE.green;
  else if (days <= 30) tone = TONE.orange;
  return { label: `Last order ${agoLabel(days)}`, ...tone };
}

/** Last-collection chip: green ≤7d, orange 8–14, red 15+; red "No collections yet" if never. */
export function collectionChip(days: number | null): Chip {
  if (days == null) return { label: "No collections yet", ...TONE.red };
  let tone: Omit<Chip, "label"> = TONE.red;
  if (days <= 7) tone = TONE.green;
  else if (days <= 14) tone = TONE.orange;
  return { label: `Last collection ${agoLabel(days)}`, ...tone };
}

/** Visit marker colours — web parity: green planned / orange unplanned. */
export const CHECKIN_PLANNED = "#16a34a";
export const CHECKIN_UNPLANNED = "#ea580c";

/** IST time (e.g. "3:06 pm") for a check-in timestamp, or "" if absent. */
export function checkinTime(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}
