/**
 * Start day tracking. Preferred mode is the native foreground service; falls back
 * to expo background updates, then a foreground watcher (Expo Go).
 */
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import { istDate } from "./day-flag";
import { PING_INTERVAL_MS, type StartDayResult, withTimeout } from "./gps-config";
import { clientSessionKey, dayOnKey, dayStartOdoKey } from "./gps-keys";
import { startNativeForegroundTracking } from "./gps-native";
import { recordLocations, startBackgroundUpdates } from "./gps-recording";
import { clearDayEnded, createServerSession, dayEndedToday, ensureClientSessionId } from "./gps-session";
import { getForegroundWatch, setClientSessionId, setForegroundWatch } from "./gps-state";
import { isDayTracking } from "./gps-status";
import { sendTrackingHeartbeatNow } from "./sync";

/**
 * Re-tapping "Start day" while the day is already tracking: refresh the day-on
 * date and nudge the native service, without resetting the 3-minute clock or
 * recording an extra point. A just-entered Start-day reading is still pushed to
 * the server (idempotent — it backfills start_odometer on the existing session).
 */
async function resumeActiveDay(opts: { startOdometer?: number | null }): Promise<StartDayResult> {
  await SecureStore.setItemAsync(dayOnKey(), istDate(Date.now())).catch(() => undefined);
  const existingClientSessionId = await SecureStore.getItemAsync(clientSessionKey()).catch(() => null);
  if (existingClientSessionId) {
    void startNativeForegroundTracking(existingClientSessionId);
    if (opts.startOdometer != null) {
      void createServerSession(existingClientSessionId, opts.startOdometer).catch(() => undefined);
    }
  }
  return { ok: true, mode: getForegroundWatch() ? "foreground" : "background" };
}

export async function startDayTracking(
  opts: { startOdometer?: number | null } = {},
): Promise<StartDayResult> {
  // Already ended today → cannot re-start until tomorrow (the server enforces
  // this too, rejecting a start when a manual-ended session exists for today).
  if (await dayEndedToday()) return { ok: false, reason: "day_ended" };

  // Keep the start reading for the day on this device BEFORE branching, so
  // End-day can enforce end > start whether this is a fresh start or a re-tap of
  // an already-running session (and when the server can't be reached). Scoped to
  // the signed-in user via dayStartOdoKey.
  if (opts.startOdometer != null) {
    await SecureStore.setItemAsync(dayStartOdoKey(), String(opts.startOdometer)).catch(
      () => undefined,
    );
  }

  // Re-pressing Start day while tracking resumes the live day (no clock reset).
  if (await isDayTracking()) return resumeActiveDay(opts);

  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return { ok: false, reason: "permission_denied" };

  // Fresh day → clear any lingering "ended" flag (defensive; a stale one from an
  // earlier day is already auto-cleared, but a same-session restart path isn't).
  await clearDayEnded();
  const clientSessionId = await ensureClientSessionId();
  setClientSessionId(clientSessionId);
  await createServerSession(clientSessionId, opts.startOdometer ?? null).catch(() => undefined);
  void sendTrackingHeartbeatNow();

  // Commit the day as "on" NOW — a durable intent (foreground permission granted,
  // server session created) — BEFORE the first-fix fetch and the GPS-transport
  // attempts below. WHICH transport carries the pings (native foreground service
  // → expo background updates → foreground watch) is best-effort. Writing the
  // flag only inside a transport's success branch made the whole start throw when
  // every transport failed — e.g. Android 14+ blocks starting a foreground-
  // location service when the app returns from the system settings screen the
  // permission flow opened. It must also NOT sit behind the first-fix fetch
  // below: a slow/never-arriving GPS fix would then leave the server session
  // created (live tracking shows on the web) but no local day-on flag, so
  // isDayTracking() read false — the app kept showing "Start day" and the SE
  // couldn't End day. Committing the flag up front keeps the day honest; the
  // watchdog + next foreground resume retry the native service for real pings.
  await SecureStore.setItemAsync(dayOnKey(), istDate(Date.now())).catch(() => undefined);

  // The day is live from this point — return NOW so the Home button flips to
  // "End day" immediately, and bring up the first fix + a GPS transport DETACHED
  // in the background. Blocking the return on them meant the button sat on "Start
  // day" for seconds: a High-accuracy first fix can be slow, and the native
  // foreground-service start can take a while (on an emulator its promise may
  // never resolve even though the service runs). The watchdog + next foreground
  // resume retry the transport if none starts right now.
  void bringUpTracking(clientSessionId);
  return { ok: true, mode: "background" };
}

/**
 * Detached from the Start-day return (see startDayTracking): capture one GPS fix
 * (time-boxed) so the route starts with a point, then start a tracking transport —
 * native foreground service → expo background updates → foreground watch. All
 * best-effort; the day is already committed, and the watchdog + next foreground
 * resume retry whatever didn't start.
 */
async function bringUpTracking(clientSessionId: string): Promise<void> {
  try {
    const first = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).catch(() => null),
      10_000,
      null,
    );
    if (first) recordLocations([first]);

    if (await startNativeForegroundTracking(clientSessionId)) return;

    const bg = await Location.requestBackgroundPermissionsAsync().catch(() => null);
    if (bg?.granted && (await startBackgroundUpdates())) return;

    getForegroundWatch()?.remove();
    setForegroundWatch(
      await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: PING_INTERVAL_MS, distanceInterval: 0 },
        (loc) => recordLocations([loc]),
      ),
    );
  } catch {
    // No transport could start (restricted OS / emulator). The day is already
    // committed, so isDayTracking() reflects it and check-in works; the native
    // service is retried by the watchdog and on the next foreground.
  }
}
