/**
 * Recovery + watchdog: restart tracking after Android kills it (battery
 * optimizers, swipe-kill), reconcile a server-closed session, and clean up a
 * stale day left over from a previous calendar day.
 */
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import { AppState } from "react-native";
import { apiFetch } from "./api";
import { useAuth } from "./auth";
import { istDate } from "./day-flag";
import { CLOSURE_RECOVERY_INTERVAL_MS } from "./gps-config";
import { clientSessionKey, dayOnKey, serverSessionKey } from "./gps-keys";
import { startNativeForegroundTracking } from "./gps-native";
import { startBackgroundUpdates } from "./gps-recording";
import { setClientSessionId } from "./gps-state";
import { isDayTracking } from "./gps-status";
import { stopDayTracking } from "./gps-stop";
import { reconcileServerTrackingSession } from "./tracking-session-recovery";

export async function reconcileServerClosedTrackingSession(): Promise<void> {
  const token = useAuth.getState().token;
  if (!token) return;
  await reconcileServerTrackingSession({
    isLocalTrackingOn: async () => {
      const dayOn = await SecureStore.getItemAsync(dayOnKey()).catch(() => null);
      const serverSessionId = await SecureStore.getItemAsync(serverSessionKey()).catch(() => null);
      return dayOn === istDate() && Boolean(serverSessionId);
    },
    getActiveSession: async () => {
      const response = await apiFetch<{ activeSession: { trackingSessionId: string } | null }>(
        "/tracking-sessions/active",
        { token },
      );
      return response.activeSession;
    },
    // Server already closed the session — stop THIS device locally only; never
    // re-issue a user-scoped end (which could hit a fresh session).
    stopLocalTracking: () => stopDayTracking({ endServerSession: false }),
    // Keep the SE logged in after closure — orders/collections still work after hours.
    clearAuthOnClosure: false,
  }).catch(() => ({ recovered: false, reason: "active" as const }));
}

/** Installed once from the root layout. */
export function installGpsWatchdog(): void {
  // On startup, tear down any day left over from a previous calendar day (the
  // day-on flag survives an app update, so it could show a false "Day is on").
  void (async () => {
    const dayOn = await SecureStore.getItemAsync(dayOnKey()).catch(() => null);
    if (dayOn && dayOn !== istDate()) await stopDayTracking({ endServerSession: false });
  })();
  AppState.addEventListener("change", (status) => {
    if (status !== "active") return;
    void (async () => {
      await reconcileServerClosedTrackingSession();
      const dayOn = await SecureStore.getItemAsync(dayOnKey()).catch(() => null);
      if (dayOn && dayOn !== istDate()) {
        await stopDayTracking({ endServerSession: false });
        return;
      }
      if (dayOn !== istDate()) return;
      const sessionId = await SecureStore.getItemAsync(clientSessionKey()).catch(() => null);
      setClientSessionId(sessionId);
      if (sessionId && (await startNativeForegroundTracking(sessionId))) return;
      if (await isDayTracking()) return;
      const bg = await Location.getBackgroundPermissionsAsync().catch(() => null);
      if (bg?.granted) await startBackgroundUpdates();
    })();
  });
  setInterval(() => {
    void (async () => {
      // Date-based local cap mirroring the native service: once the IST day has
      // rolled over, tear this device's tracking down (local only — the server's
      // midnight-cap cron does the authoritative session close).
      const dayOn = await SecureStore.getItemAsync(dayOnKey()).catch(() => null);
      if (dayOn && dayOn !== istDate()) {
        await stopDayTracking({ endServerSession: false });
        return;
      }
      await reconcileServerClosedTrackingSession();
    })();
  }, CLOSURE_RECOVERY_INTERVAL_MS);
}
