/**
 * Tracking-uploader lifecycle: the network listener, app-lifecycle listener, and
 * the 3-min heartbeat timer that drive kickSync() (GPS ping flush + heartbeat)
 * while a work day is on.
 */
import * as Network from "expo-network";
import * as SecureStore from "expo-secure-store";
import { AppState } from "react-native";
import { dayFlagIsForToday } from "./day-flag";
import { dayOnKey } from "./gps-keys";
import { kickSync } from "./sync-kick";
import { sendTrackingHeartbeatNow } from "./sync-heartbeat";

const HEARTBEAT_INTERVAL_MS = 3 * 60 * 1000;

let started = false;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
// Subscriptions kept so stopSyncEngine() can fully tear the engine down (used
// when a Super Admin session takes over — the SA app is online-only).
let netSub: { remove: () => void } | null = null;
let appStateSub: { remove: () => void } | null = null;

/** Call once at app start (after auth hydration). Safe to call repeatedly. */
export function startSyncEngine(): void {
  if (started) return;
  started = true;

  netSub = Network.addNetworkStateListener((state) => {
    const connected = Boolean(state.isConnected) && state.isInternetReachable !== false;
    // On reconnect, push any GPS pings buffered while offline.
    if (connected) void kickSync();
  });

  appStateSub = AppState.addEventListener("change", (status) => {
    if (status === "active") {
      void kickSync();
      void sendTrackingHeartbeatNow();
    }
  });

  heartbeatTimer = setInterval(() => {
    void SecureStore.getItemAsync(dayOnKey())
      .then((dayOn) => {
        // Fire the 3-min heartbeat only while a day is on (today's IST date). The
        // flag is cleared on a manual End day and when the IST date rolls over, so
        // the heartbeat/sync naturally stops then — no fixed-hour cutoff. (The flag
        // was once the literal "1"; matching the real date flag is what makes the
        // heartbeat fire at all, and flush queued pings on the same tick.)
        if (dayFlagIsForToday(dayOn)) {
          void sendTrackingHeartbeatNow();
          void kickSync();
        }
      })
      .catch(() => undefined);
  }, HEARTBEAT_INTERVAL_MS);

  void kickSync();
}

/** Fully tear the sync engine down: stop the heartbeat timer and drop the
 *  network/appstate listeners so NO background heartbeat, bulk pull, or prefetch
 *  keeps running. Called when a Super Admin session is active — the SA app is
 *  online-only and must not run any of the offline/sync machinery. Safe to call
 *  repeatedly and when the engine was never started. */
export function stopSyncEngine(): void {
  if (!started) return;
  started = false;
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  netSub?.remove();
  netSub = null;
  appStateSub?.remove();
  appStateSub = null;
}
