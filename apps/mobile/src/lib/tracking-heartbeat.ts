import {
  buildTrackingHeartbeat,
  type GpsHeartbeatState,
  type TrackingHeartbeatDeviceState,
  type TrackingHeartbeatPayload,
} from "./sync-core";

export interface SendTrackingHeartbeatDeps {
  getServerSessionId: () => Promise<string | null>;
  getQueueState: () => GpsHeartbeatState;
  getDeviceState: () => Promise<TrackingHeartbeatDeviceState>;
  getLastSuccessfulSyncAt: () => number | null;
  post: (path: string, body: TrackingHeartbeatPayload) => Promise<unknown>;
  now?: () => Date;
}

export function normalizeBatteryState(input: {
  batteryLevel: number | null;
  batteryState: string | number | null;
  lowPowerMode: boolean | null;
}): Pick<TrackingHeartbeatDeviceState, "batteryPercentage" | "isCharging" | "isLowPowerModeEnabled"> {
  const percentage =
    input.batteryLevel === null || !Number.isFinite(input.batteryLevel)
      ? null
      : Math.max(0, Math.min(100, Math.round(input.batteryLevel * 100)));
  const state = String(input.batteryState ?? "").toLowerCase();
  return {
    batteryPercentage: percentage,
    isCharging: state === "charging" || state === "full" || state === "2" || state === "3",
    isLowPowerModeEnabled: input.lowPowerMode,
  };
}

export async function sendTrackingHeartbeat(
  deps: SendTrackingHeartbeatDeps,
): Promise<{ sent: boolean }> {
  const sessionId = await deps.getServerSessionId();
  if (!sessionId) return { sent: false };

  const lastSuccessfulSyncAt = deps.getLastSuccessfulSyncAt();
  const payload = buildTrackingHeartbeat({
    capturedAt: (deps.now?.() ?? new Date()).toISOString(),
    queue: deps.getQueueState(),
    device: await deps.getDeviceState(),
    lastSuccessfulSyncAt: lastSuccessfulSyncAt === null ? null : new Date(lastSuccessfulSyncAt).toISOString(),
  });

  await deps.post(`/tracking-sessions/${sessionId}/heartbeat`, payload);
  return { sent: true };
}
