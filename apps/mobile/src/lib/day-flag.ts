/**
 * Date-scoping for the "day tracking on" flag (see gps.ts). The flag is stamped
 * with the IST calendar date the day was started; a flag from any earlier day —
 * or the legacy "1" value — is stale. Without this, an SE day that wasn't cleanly
 * stopped before the 8 PM cutoff lingers as a false "Day is on", and it survives
 * an app update because SecureStore persists across updates.
 *
 * Kept free of native/Expo imports so it can be unit-tested in Node.
 */

/** IST calendar date (yyyy-mm-dd) for a timestamp — device timezone irrelevant. */
export function istDate(ms: number = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

/** True only when the stored day-on flag holds TODAY's IST date. */
export function dayFlagIsForToday(stored: string | null, todayIst: string = istDate()): boolean {
  return stored !== null && stored === todayIst;
}

/** IST hour of day (0–23) for a timestamp — for the 8 PM heartbeat cutoff. */
export function istHour(ms: number = Date.now()): number {
  const h = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date(ms))
    .find((p) => p.type === "hour")?.value;
  return Number(h ?? "0") % 24;
}
