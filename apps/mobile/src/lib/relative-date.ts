/**
 * Turn a bare business date ("YYYY-MM-DD") into a short relative label in plain
 * days: "today" for the same day, otherwise "N days ago" ("1 day ago",
 * "212 days ago") — exact day count, never rolled up into weeks/months. Used on
 * the beat row for last order / last collection recency. Calendar-day based
 * (local midnight), so it doesn't drift by hours. Null for a missing/bad date.
 */

/**
 * Whole calendar days between a bare business date and `now` (local midnight).
 * 0 for the same day or a future date; null for a missing/bad date. Drives both
 * the relative label and the beat activity-chip colour.
 */
export function daysSince(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso || iso.length < 10) return null;
  // Parse as LOCAL midnight — `new Date("2026-09-12")` is UTC, which is the
  // previous day on a device west of UTC.
  const then = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(then.getTime())) return null;

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfThen = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const MS_PER_DAY = 86_400_000;
  const days = Math.round((startOfToday.getTime() - startOfThen.getTime()) / MS_PER_DAY);
  return Math.max(0, days); // clamp a future date to 0 ("today")
}

export function relativeDay(iso: string | null | undefined, now: Date = new Date()): string | null {
  const days = daysSince(iso, now);
  if (days === null) return null;
  if (days <= 0) return "today"; // today or (defensively) a future date
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
