import { daysSince, relativeDay } from "../relative-date";

/**
 * The two beat activity chips — "Last order …" and "Last collection …" — shown
 * side by side below the dues chip. Each carries a full-word label plus a colour
 * graded green → orange → red by how stale the activity is. A customer who has
 * never ordered / collected shows a RED "No orders/collections yet" chip.
 *
 * Thresholds (interpretation A — the edge day is the lower severity):
 *   order:      green 0–21,  orange 22–30,  red 31+
 *   collection: green 0–7,   orange 8–14,   red 15+
 */
export type ActivityKind = "order" | "collection";

export interface ActivityChip {
  text: string;
  bgClass: string;
  textClass: string;
}

const GREEN = { bgClass: "bg-emerald-100", textClass: "text-emerald-700" };
const ORANGE = { bgClass: "bg-orange-100", textClass: "text-orange-700" };
const RED = { bgClass: "bg-red-100", textClass: "text-red-700" };

function tone(kind: ActivityKind, days: number) {
  if (kind === "order") {
    if (days <= 21) return GREEN;
    if (days <= 30) return ORANGE;
    return RED;
  }
  if (days <= 7) return GREEN;
  if (days <= 14) return ORANGE;
  return RED;
}

export function activityChip(
  kind: ActivityKind,
  iso: string | null | undefined,
  now: Date = new Date(),
): ActivityChip {
  const days = daysSince(iso, now);
  if (days === null) {
    // Never ordered / collected → worst case, red.
    return { text: kind === "order" ? "No orders yet" : "No collections yet", ...RED };
  }
  const prefix = kind === "order" ? "Last order" : "Last collection";
  return { text: `${prefix} ${relativeDay(iso, now)}`, ...tone(kind, days) };
}
