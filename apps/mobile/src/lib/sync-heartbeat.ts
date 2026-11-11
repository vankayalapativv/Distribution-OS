/**
 * Tracking heartbeat: posts the current device/queue state to the server (used
 * on foreground, on the 3-min timer, and at the tail of every flush).
 */
import { apiFetch } from "./api";
import { useAuth } from "./auth";
import { getLocalDb } from "./db";
import { getGpsHeartbeatState } from "./sync-core";
import { sendTrackingHeartbeat } from "./tracking-heartbeat";
import { ensureServerTrackingSession } from "./sync-tracking-session";
import { getTrackingHeartbeatDeviceState } from "./sync-device-state";
import { useSyncStore } from "./sync-store";

export async function sendTrackingHeartbeatNow(): Promise<{ sent: boolean }> {
  const token = useAuth.getState().token;
  const db = getLocalDb();
  if (!token || !db) return { sent: false };

  return sendTrackingHeartbeat({
    getServerSessionId: () => ensureServerTrackingSession([]),
    getQueueState: () => getGpsHeartbeatState(db),
    getDeviceState: getTrackingHeartbeatDeviceState,
    getLastSuccessfulSyncAt: () => useSyncStore.getState().lastSyncedAt,
    post: (path, body) => apiFetch(path, { method: "POST", token, body }),
  }).catch(() => ({ sent: false }));
}
