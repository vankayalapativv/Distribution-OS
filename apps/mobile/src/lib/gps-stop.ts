/**
 * Stop tracking on THIS device (and, by default, close the server session too —
 * used by an explicit Logistics "End run").
 *
 * On LOGOUT pass endServerSession:false: the tracking session is per-USER and
 * these accounts are shared (a manager/client may open a field worker's account
 * to view), so ending the server session would kill the worker's live run on
 * THEIR phone. Logout stops only this device; SE days end via the 8 PM cron.
 */
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import { apiFetch } from "./api";
import { useAuth } from "./auth";
import { GPS_TASK, LEGACY_UNSCOPED_KEYS, NATIVE_TEARDOWN_TIMEOUT_MS, withTimeout } from "./gps-config";
import {
  clientSessionKey,
  dayOnKey,
  dayStartOdoKey,
  serverSessionKey,
} from "./gps-keys";
import { stopNativeForegroundTracking } from "./gps-native";
import { getForegroundWatch, setClientSessionId, setForegroundWatch } from "./gps-state";
import { kickSync } from "./sync";

export async function stopDayTracking(
  options: { endServerSession?: boolean; endOdometer?: number | null } = {},
): Promise<void> {
  const endServerSession = options.endServerSession ?? true;
  await SecureStore.deleteItemAsync(dayOnKey()).catch(() => undefined);
  // The day's start reading has done its job (End-day's end ≥ start check) — clear it.
  await SecureStore.deleteItemAsync(dayStartOdoKey()).catch(() => undefined);
  const serverSessionId = await SecureStore.getItemAsync(serverSessionKey()).catch(() => null);
  await SecureStore.deleteItemAsync(clientSessionKey()).catch(() => undefined);
  await SecureStore.deleteItemAsync(serverSessionKey()).catch(() => undefined);
  // Scrub any legacy device-GLOBAL keys from a pre-scoping install so they can't
  // linger as another user's stale day/session on this shared device. Independent
  // keys → delete them in parallel.
  await Promise.all(
    LEGACY_UNSCOPED_KEYS.map((k) => SecureStore.deleteItemAsync(k).catch(() => undefined)),
  );
  setClientSessionId(null);
  getForegroundWatch()?.remove();
  setForegroundWatch(null);
  // Each native GPS call is time-boxed: a wedged foreground service or stuck
  // location-updates teardown must not hang the End-run button forever (its
  // spinner never clearing is exactly the field "can't end the run" report).
  await withTimeout(stopNativeForegroundTracking(), NATIVE_TEARDOWN_TIMEOUT_MS, undefined);
  const running = await withTimeout(
    Location.hasStartedLocationUpdatesAsync(GPS_TASK).catch(() => false),
    NATIVE_TEARDOWN_TIMEOUT_MS,
    false,
  );
  if (running) {
    await withTimeout(
      Location.stopLocationUpdatesAsync(GPS_TASK).catch(() => undefined),
      NATIVE_TEARDOWN_TIMEOUT_MS,
      undefined,
    );
  }
  void kickSync(); // push any remaining queued pings

  if (!endServerSession) return;

  // Close today's session on the server so the dashboard shows "day ended".
  // Best-effort: offline End-day still stops tracking; the session then just
  // ages out on the dashboard instead of closing crisply.
  const token = useAuth.getState().token;
  if (token && serverSessionId) {
    // A client end is a MANUAL end (SE "End day" / Logistics "End run"); the
    // server tags it 'manual' so attendance can show an "Ended" time. The SE
    // End-day flow also sends the whole-km ending odometer (Logistics omits it).
    const body: { endedReason: string; endOdometer?: number } = { endedReason: "manual" };
    if (options.endOdometer != null) body.endOdometer = options.endOdometer;
    await apiFetch(`/tracking-sessions/${serverSessionId}/end`, {
      method: "POST",
      token,
      body,
    }).catch(() => undefined);
  } else if (token) {
    await apiFetch("/visits/gps/end", { method: "POST", token, body: {} }).catch(() => undefined);
  }
}
