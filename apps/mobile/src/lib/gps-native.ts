/**
 * Native foreground-tracking service glue (Android). getNativeTracking() returns
 * null on iOS / Expo Go where the module isn't present, so callers fall back.
 */
import * as SecureStore from "expo-secure-store";
import { NativeModules, Platform } from "react-native";
import { API_BASE_URL } from "./api";
import { useAuth } from "./auth";
import { istDate } from "./day-flag";
import { serverSessionKey } from "./gps-keys";

type NativeTrackingModule = {
  startForegroundTracking?: (
    clientSessionId: string | null,
    serverSessionId: string | null,
    // The IST date ("yyyy-MM-dd") the day started; the native service self-stops
    // once the IST date rolls past it (the midnight cap). null = no cap (Logistics).
    capDateIst: string | null,
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

export async function startNativeForegroundTracking(clientSessionId: string): Promise<boolean> {
  const native = getNativeTracking();
  if (!native?.startForegroundTracking) return false;
  const serverSessionId = await SecureStore.getItemAsync(serverSessionKey()).catch(() => null);
  // Refresh upload credentials every (re)start — incl. watchdog restarts — so the
  // service can push pings on its own while backgrounded. Token TTL is 7 days.
  await native.setUploadContext?.(useAuth.getState().token, API_BASE_URL).catch(() => undefined);
  // SEs are capped at the next IST midnight (date-based); Logistics has no cap.
  // The cap date is the current IST day — the service self-stops once it rolls over.
  const capDateIst = useAuth.getState().user?.role === "SALES_EXECUTIVE" ? istDate(Date.now()) : null;
  return native
    .startForegroundTracking(clientSessionId, serverSessionId, capDateIst)
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
