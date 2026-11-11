/**
 * Tracking-session helpers: lazily start the server tracking session and route
 * GPS ping batches to the session endpoint (falling back to the legacy path).
 */
import * as SecureStore from "expo-secure-store";
import { apiFetch } from "./api";
import { useAuth } from "./auth";
import { clientSessionKey, serverSessionKey } from "./gps-keys";
import type { GpsPingInput } from "./sync-core";

export async function ensureServerTrackingSession(points: GpsPingInput[]): Promise<string | null> {
  const token = useAuth.getState().token;
  if (!token) return null;
  const existing = await SecureStore.getItemAsync(serverSessionKey()).catch(() => null);
  if (existing) return existing;

  const clientSessionId =
    points.find((p) => p.clientSessionId)?.clientSessionId ??
    (await SecureStore.getItemAsync(clientSessionKey()).catch(() => null));
  if (!clientSessionId) return null;

  const session = await apiFetch<{ trackingSessionId: string }>("/tracking-sessions/start", {
    method: "POST",
    token,
    body: { clientSessionId, deviceId: null },
  });
  await SecureStore.setItemAsync(serverSessionKey(), session.trackingSessionId).catch(() => undefined);
  return session.trackingSessionId;
}

export async function sendGpsBatch(points: GpsPingInput[]): Promise<unknown> {
  const token = useAuth.getState().token;
  const sessionId = await ensureServerTrackingSession(points);
  if (!sessionId) {
    return apiFetch("/visits/gps/batch", {
      method: "POST",
      body: { points },
      token,
    });
  }

  return apiFetch(`/tracking-sessions/${sessionId}/points/batch`, {
    method: "POST",
    body: { points },
    token,
  });
}
