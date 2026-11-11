/**
 * Pure formatting for the tracking map overlays — the SAME rules/colours as the
 * web Live-Tracking + dashboard map, so a customer reads identically on both.
 * Kept import-light (one type import) so it's trivially unit-testable.
 */
import type { DuesBucketKey } from "./admin-tracking";

/** Dues ageing bucket → label + pin colour (web BUCKET_META, verbatim). */
export const BUCKET_META: Record<DuesBucketKey, { label: string; color: string }> = {
  "0_30": { label: "0–30 days", color: "#10b981" }, // emerald-500
  "30_45": { label: "31–45 days", color: "#eab308" }, // yellow-500
  "45_60": { label: "46–60 days", color: "#f97316" }, // orange-500
  "60_plus": { label: "61+ days", color: "#f43f5e" }, // rose-500
};
/** No-dues / clear pin colour (slate-400). */
export const CLEAR_COLOR = "#94a3b8";

export function bucketColor(bucket: DuesBucketKey | null): string {
  return bucket ? BUCKET_META[bucket].color : CLEAR_COLOR;
}
export function bucketLabel(bucket: DuesBucketKey | null): string {
  return bucket ? BUCKET_META[bucket].label : "No dues";
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
