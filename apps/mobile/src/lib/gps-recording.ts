/**
 * The GPS ping recorder: date-guard + dedupe fixes, insert into SQLite, kick
 * sync. Registered as the background TaskManager task, and started (foreground
 * service / expo background updates) via startBackgroundUpdates.
 */
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { getLocalDb } from "./db";
import {
  GPS_TASK,
  MIN_PING_GAP_MS,
  PING_INTERVAL_MS,
  guardedRecordMs,
} from "./gps-config";
import { getClientSessionId } from "./gps-state";
import { kickSync } from "./sync";
import { insertGpsPing } from "./sync-core";

export function recordLocations(locations: Location.LocationObject[]): void {
  // No fixed-hour cutoff: the day runs until the SE ends it or the IST date rolls
  // over. End-of-day teardown is handled by the manual End-day flow, the native
  // date cap, and the watchdog's date-rollover stop (not by dropping a late fix
  // here); the server also drops any point whose IST date is past the start day.
  const db = getLocalDb();
  if (!db) return;
  const last = db.first<{ ts: string | null }>("select max(recorded_at) as ts from gps_pings");
  let lastKeptMs = last?.ts ? Date.parse(last.ts) : 0;
  const now = Date.now();
  // Sort by the guarded record time, not the raw fix time (a stale cached fix
  // must not jump ahead of / behind fresh ones).
  const ordered = [...locations]
    .map((loc) => ({ loc, recordedMs: guardedRecordMs(loc.timestamp, now) }))
    .sort((a, b) => a.recordedMs - b.recordedMs);
  let kept = 0;
  for (const { loc, recordedMs } of ordered) {
    // Drop only near-duplicates. The second clause is overdue-fix recovery: a fix
    // that already fills a gap ≥ the 3-min cadence is ALWAYS kept, never dropped.
    const gap = recordedMs - lastKeptMs;
    if (gap < MIN_PING_GAP_MS && gap < PING_INTERVAL_MS) continue;
    insertGpsPing(db, {
      clientSessionId: getClientSessionId(),
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy: loc.coords.accuracy ?? null,
      batteryPercentage: null,
      recordedAt: new Date(recordedMs).toISOString(),
    });
    lastKeptMs = recordedMs;
    kept += 1;
  }
  if (kept > 0) void kickSync();
}

TaskManager.defineTask(GPS_TASK, async ({ data, error }) => {
  if (error || !data) return;
  recordLocations((data as { locations: Location.LocationObject[] }).locations ?? []);
});

export async function startBackgroundUpdates(): Promise<boolean> {
  try {
    await Location.startLocationUpdatesAsync(GPS_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: PING_INTERVAL_MS,
      distanceInterval: 0,
      foregroundService: {
        notificationTitle: "Distribution OS — day tracking on",
        notificationBody: "Your route is recorded until the end of your day.",
      },
    });
    return true;
  } catch {
    return false; // Expo Go: background tasks unavailable
  }
}
