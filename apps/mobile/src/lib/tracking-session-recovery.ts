export interface ActiveTrackingSessionSnapshot {
  trackingSessionId: string;
}

export interface TrackingSessionRecoveryDeps {
  isLocalTrackingOn: () => Promise<boolean>;
  getActiveSession: () => Promise<ActiveTrackingSessionSnapshot | null>;
  stopLocalTracking: () => Promise<void>;
  clearAuth?: () => Promise<void>;
  clearAuthOnClosure?: boolean;
}

export type TrackingSessionRecoveryResult =
  | { recovered: true; reason: "server_closed" }
  | { recovered: false; reason: "local_off" | "active" };

export async function reconcileServerTrackingSession(
  deps: TrackingSessionRecoveryDeps,
): Promise<TrackingSessionRecoveryResult> {
  if (!(await deps.isLocalTrackingOn())) {
    return { recovered: false, reason: "local_off" };
  }

  const active = await deps.getActiveSession();
  if (active) {
    return { recovered: false, reason: "active" };
  }

  await deps.stopLocalTracking();
  if (deps.clearAuthOnClosure) {
    await deps.clearAuth?.();
  }
  return { recovered: true, reason: "server_closed" };
}
