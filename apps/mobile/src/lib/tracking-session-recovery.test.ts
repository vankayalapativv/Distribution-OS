import { describe, expect, test, vi } from "vitest";
import { reconcileServerTrackingSession } from "./tracking-session-recovery";

describe("reconcileServerTrackingSession", () => {
  test("stops local tracking when the server has already closed the day", async () => {
    const stopLocalTracking = vi.fn().mockResolvedValue(undefined);
    const clearAuth = vi.fn().mockResolvedValue(undefined);

    const result = await reconcileServerTrackingSession({
      isLocalTrackingOn: async () => true,
      getActiveSession: async () => null,
      stopLocalTracking,
      clearAuth,
      clearAuthOnClosure: true,
    });

    expect(result).toEqual({ recovered: true, reason: "server_closed" });
    expect(stopLocalTracking).toHaveBeenCalledTimes(1);
    expect(clearAuth).toHaveBeenCalledTimes(1);
  });

  test("does nothing while the server still has an active session", async () => {
    const stopLocalTracking = vi.fn();

    const result = await reconcileServerTrackingSession({
      isLocalTrackingOn: async () => true,
      getActiveSession: async () => ({ trackingSessionId: "session-1" }),
      stopLocalTracking,
    });

    expect(result).toEqual({ recovered: false, reason: "active" });
    expect(stopLocalTracking).not.toHaveBeenCalled();
  });

  test("does not call the server when local tracking is already off", async () => {
    const getActiveSession = vi.fn();

    const result = await reconcileServerTrackingSession({
      isLocalTrackingOn: async () => false,
      getActiveSession,
      stopLocalTracking: vi.fn(),
    });

    expect(result).toEqual({ recovered: false, reason: "local_off" });
    expect(getActiveSession).not.toHaveBeenCalled();
  });
});
