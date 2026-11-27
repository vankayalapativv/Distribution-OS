/**
 * Read-only tracking / permission status queries used by the tiles, the settings
 * screen, and the Start-day flow.
 */
import { useAuth } from "./auth";
import { istHour } from "./day-flag";
import { SE_CUTOFF_HOUR } from "./gps-config";
import { dayEndedToday, dayStartedToday } from "./gps-session";
import { getForegroundWatch } from "./gps-state";

/** True when the signed-in Sales Executive is past the fixed 8 PM cutoff on the
 *  current IST day — a fresh Start day is blocked until tomorrow. Logistics is
 *  never blocked by the hour (a run runs to the IST-date rollover). */
export function isPastSeCutoff(): boolean {
  if (useAuth.getState().user?.role !== "SALES_EXECUTIVE") return false;
  return istHour() >= SE_CUTOFF_HOUR;
}

export async function isDayTracking(): Promise<boolean> {
  // Once the SE has ended their day (the manual "End day" button), the tile must
  // read off even though the day-on flag may linger until midnight. A day ended
  // today is not tracking. (Logistics never set this flag.)
  if (await dayEndedToday()) return false;
  if (getForegroundWatch()) return true;
  // The durable, date-scoped day flag is AUTHORITATIVE for the UI: a day committed
  // today is on. It survives a JS reload/relaunch that wiped the in-memory
  // transport flags and clears before the watchdog re-attaches the native service,
  // so the SE still reads "End day" after reopening the app. (Previously this also
  // required a live GPS transport, which made a mid-day reload wrongly fall back to
  // "Start day" while the server session was still active.) A stale flag from an
  // earlier day is cleared inside dayStartedToday(); the watchdog / foreground
  // resume keep the GPS transport itself alive.
  return dayStartedToday();
}
