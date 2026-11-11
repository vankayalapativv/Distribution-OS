import { describe, expect, test, vi } from "vitest";
import { normalizeBatteryState, sendTrackingHeartbeat } from "./tracking-heartbeat";

describe("sendTrackingHeartbeat", () => {
  test("normalizes Expo battery values for heartbeat payloads", () => {
    expect(normalizeBatteryState({
      batteryLevel: 0.62,
      batteryState: "charging",
      lowPowerMode: true,
    })).toEqual({
      batteryPercentage: 62,
      isCharging: true,
      isLowPowerModeEnabled: true,
    });
  });

  test("posts the heartbeat to the canonical tracking session endpoint", async () => {
    const post = vi.fn().mockResolvedValue({});

    const result = await sendTrackingHeartbeat({
      getServerSessionId: async () => "session-1",
      getQueueState: () => ({ queuedPointCount: 2, lastLocationAt: "2026-07-09T09:03:00.000Z" }),
      getDeviceState: async () => ({
        deviceId: "android-1",
        isLocationEnabled: true,
        foregroundPermission: "granted",
        backgroundPermission: "granted",
        notificationPermission: "granted",
        networkType: "wifi",
        isConnected: true,
        appVersion: "1.4.0",
        androidVersion: "15",
        manufacturer: "Samsung",
        model: "SM-A556E",
      }),
      getLastSuccessfulSyncAt: () => 1_752_050_000_000,
      now: () => new Date("2026-07-09T09:06:00.000Z"),
      post,
    });

    expect(result.sent).toBe(true);
    expect(post).toHaveBeenCalledWith("/tracking-sessions/session-1/heartbeat", {
      capturedAt: "2026-07-09T09:06:00.000Z",
      deviceId: "android-1",
      queuedPointCount: 2,
      lastLocationAt: "2026-07-09T09:03:00.000Z",
      lastSuccessfulSyncAt: "2025-07-09T08:33:20.000Z",
      isLocationEnabled: true,
      foregroundPermission: "granted",
      backgroundPermission: "granted",
      notificationPermission: "granted",
      networkType: "wifi",
      isConnected: true,
      appVersion: "1.4.0",
      androidVersion: "15",
      manufacturer: "Samsung",
      model: "SM-A556E",
      batteryPercentage: null,
      isCharging: null,
      isLowPowerModeEnabled: null,
      batteryOptimizationStatus: null,
    });
  });

  test("does not post when no server session is available", async () => {
    const post = vi.fn();

    const result = await sendTrackingHeartbeat({
      getServerSessionId: async () => null,
      getQueueState: () => ({ queuedPointCount: 0, lastLocationAt: null }),
      getDeviceState: async () => ({
        deviceId: null,
        isLocationEnabled: null,
        foregroundPermission: "unknown",
        backgroundPermission: "unknown",
        notificationPermission: "unknown",
        networkType: null,
        isConnected: null,
        appVersion: null,
        androidVersion: null,
        manufacturer: null,
        model: null,
      }),
      getLastSuccessfulSyncAt: () => null,
      post,
    });

    expect(result.sent).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });
});
