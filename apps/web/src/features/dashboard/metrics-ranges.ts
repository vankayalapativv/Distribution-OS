import { formatDayMonth } from "@/lib/format";
import type { Preset } from "./metrics-helpers";

/** Local `YYYY-MM-DD` (not UTC) — used to build the query range. */
export function isoDate(d: Date): string {
  return d.toLocaleDateString("en-CA");
}

export function rangeLabel(from: string, to: string): string {
  return from === to ? formatDayMonth(from) : `${formatDayMonth(from)} – ${formatDayMonth(to)}`;
}

export function presetRange(preset: Preset): { from: string; to: string } {
  // Anchor to IST (the business timezone + the server/greeting basis), not the
  // browser's local clock — so an admin on a non-IST machine still gets the same
  // today/week/month window the server computes. `now`'s local fields now hold
  // the IST wall-clock, so isoDate (local en-CA) + getDay/getMonth read as IST.
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const to = isoDate(now);
  if (preset === "week") {
    // Current week's Monday → today (not a trailing 7 days, which would start in
    // the previous week). getDay(): Sun=0..Sat=6 → days since Monday.
    const start = new Date(now);
    const daysFromMonday = (start.getDay() + 6) % 7; // Mon=0, …, Sun=6
    start.setDate(start.getDate() - daysFromMonday);
    return { from: isoDate(start), to };
  }
  if (preset === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: isoDate(start), to };
  }
  return { from: to, to };
}
