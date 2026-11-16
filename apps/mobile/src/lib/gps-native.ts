/**
 * Native foreground-tracking service glue (Android). getNativeTracking() returns
 * null on iOS / Expo Go where the module isn't present, so callers fall back.
 */
import * as SecureStore from "expo-secure-store";
import { NativeModules, Platform } from "react-native";
import { API_BASE_URL } from "./api";
import { useAuth } from "./auth";
import { istDate } from "./day-flag";
import { DEFAULT_SE_STOP_HOUR } from "./gps-config";
import { serverSessionKey, stopHourKey } from "./gps-keys";

type NativeTrackingModule = {
  startForegroundTracking?: (
    clientSessionId: string | null,
    serverSessionId: string | null,
    // The IST date ("yyyy-MM-dd") the day started; the native service self-stops
    // once the IST date rolls past it (safety cap). null = no cap (Logistics).
    capDateIst: string | null,
    // The IST hour (0–23) on the cap date at which the service self-stops for the
    // day (the SE auto-stop), as a string to match the nullable-String bridge
    // pattern. null = no hour cap (Logistics / unknown).
    capHourIst: string | null,
  ) => Promise<boolean>;
  stopForegroundTracking?: () => Promise<boolean>;
  /** Auth-level guard: false after logout so the native service refuses to run
   *  (and the boot receiver won't restart it) even if a stop was missed. */
  setSignedIn?: (signedIn: boolean) => Promise<boolean>;
  /** Give the native service the API base URL + bearer token so it can upload
   *  pings itself while the JS app is backgrounded/killed. */
  setUploadContext?: (token: string | null, baseUrl: string | null) => Promise<boolean>;
};

export function getNativeTracking(): NativeTrackingModule | null {
  if (Platform.OS !== "android") return null;
  const native = NativeModules.NativeTracking as NativeTrackingModule | undefined;
  return native?.startForegroundTracking && native?.stopForegroundTracking ? native : null;
}

/** The cached SE auto-stop hour (0–23), or the default (7 PM) when not yet known
 *  (e.g. the very first day before the server session has been created). */
export async function readSeStopHour(): Promise<number> {
  const raw = await SecureStore.getItemAsync(stopHourKey()).catch(() => null);
  const n = raw === null ? Number.NaN : Number.parseInt(raw, 10);
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : DEFAULT_SE_STOP_HOUR;
}

export async function startNativeForegroundTracking(clientSessionId: string): Promise<boolean> {
  const native = getNativeTracking();
  if (!native?.startForegroundTracking) return false;
  const serverSessionId = await SecureStore.getItemAsync(serverSessionKey()).catch(() => null);
  // Refresh upload credentials every (re)start — incl. watchdog restarts — so the
  // service can push pings on its own while backgrounded. Token TTL is 7 days.
  await native.setUploadContext?.(useAuth.getState().token, API_BASE_URL).catch(() => undefined);
  // SEs self-stop at the configured hour on the start IST day (default 7 PM), with
  // the date as a safety cap; Logistics has no cap at all.
  const isSe = useAuth.getState().user?.role === "SALES_EXECUTIVE";
  const capDateIst = isSe ? istDate(Date.now()) : null;
  const capHourIst = isSe ? String(await readSeStopHour()) : null;
  return native
    .startForegroundTracking(clientSessionId, serverSessionId, capDateIst, capHourIst)
    .then(Boolean)
    .catch(() => false);
}

export async function stopNativeForegroundTracking(): Promise<void> {
  await getNativeTracking()?.stopForegroundTracking?.().catch(() => false);
}

/**
 * Mirror the auth session into the native service — `false` on logout, `true` on
 * login / app start (with a token). "Signed out" is a hard stop condition, so
 * tracking can't outlive a session even if the JS stop path is skipped (crash
 * mid-logout). No-op on iOS / non-native builds.
 */
export async function setNativeSignedIn(signedIn: boolean): Promise<void> {
  if (Platform.OS !== "android") return;
  const native = NativeModules.NativeTracking as NativeTrackingModule | undefined;
  await native?.setSignedIn?.(signedIn).catch(() => undefined);
  // On sign-in, hand the service a fresh token + base URL so background uploads
  // work from the next capture. (setSignedIn(false) clears the token natively.)
  if (signedIn) {
    await native?.setUploadContext?.(useAuth.getState().token, API_BASE_URL).catch(() => undefined);
  }
}
