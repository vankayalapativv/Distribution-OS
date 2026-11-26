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

  test("handles null / non-finite battery levels and the various charging states", () => {
    expect(normalizeBatteryState({ batteryLevel: null, batteryState: "unplugged", lowPowerMode: false }).batteryPercentage).toBeNull();
    expect(normalizeBatteryState({ batteryLevel: Number.NaN, batteryState: null, lowPowerMode: null }).batteryPercentage).toBeNull();
    expect(normalizeBatteryState({ batteryLevel: 1, batteryState: "full", lowPowerMode: false }).isCharging).toBe(true);
    expect(normalizeBatteryState({ batteryLevel: 0.5, batteryState: 2, lowPowerMode: false }).isCharging).toBe(true);
    expect(normalizeBatteryState({ batteryLevel: 0.5, batteryState: 3, lowPowerMode: false }).isCharging).toBe(true);
    expect(normalizeBatteryState({ batteryLevel: 0.5, batteryState: "unplugged", lowPowerMode: false }).isCharging).toBe(false);
  });

  test("defaults the capture time and tolerates a null last-sync time", async () => {
    const post = vi.fn().mockResolvedValue({});
    const result = await sendTrackingHeartbeat({
      getServerSessionId: async () => "session-2",
      getQueueState: () => ({ queuedPointCount: 0, lastLocationAt: null }),
      getDeviceState: async () => ({
        deviceId: "a1", isLocationEnabled: true, foregroundPermission: "granted", backgroundPermission: "granted",
        notificationPermission: "granted", networkType: "wifi", isConnected: true, appVersion: "1", androidVersion: "15",
        manufacturer: "S", model: "M",
      }),
      getLastSuccessfulSyncAt: () => null, // → lastSuccessfulSyncAt stays null
      post, // no `now` → capturedAt falls back to new Date()
    });
    expect(result.sent).toBe(true);
    const payload = post.mock.calls[0][1] as { capturedAt: string; lastSuccessfulSyncAt: string | null };
    expect(payload.lastSuccessfulSyncAt).toBeNull();
    expect(payload.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
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
