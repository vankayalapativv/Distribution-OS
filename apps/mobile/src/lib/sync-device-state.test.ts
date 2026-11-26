import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStartDayHealthChecklist, getTrackingHeartbeatDeviceState } from "./sync-device-state";

const getForegroundPermissionsAsync = vi.fn();
const getBackgroundPermissionsAsync = vi.fn();
const hasServicesEnabledAsync = vi.fn();
const getNotifPermissionsAsync = vi.fn();
const getNetworkStateAsync = vi.fn();
const getPowerStateAsync = vi.fn();
const isBatteryOptimizationEnabledAsync = vi.fn();
const buildStartDayHealthChecklist = vi.fn<(...a: unknown[]) => { ready: boolean }>(() => ({ ready: true }));

vi.mock("expo-location", () => ({
  getForegroundPermissionsAsync: () => getForegroundPermissionsAsync(),
  getBackgroundPermissionsAsync: () => getBackgroundPermissionsAsync(),
  hasServicesEnabledAsync: () => hasServicesEnabledAsync(),
}));
vi.mock("expo-notifications", () => ({ getPermissionsAsync: () => getNotifPermissionsAsync() }));
vi.mock("expo-network", () => ({ getNetworkStateAsync: () => getNetworkStateAsync() }));
vi.mock("expo-battery", () => ({
  getPowerStateAsync: () => getPowerStateAsync(),
  isBatteryOptimizationEnabledAsync: () => isBatteryOptimizationEnabledAsync(),
}));
let constantsConfig: { version?: string } | null = { version: "1.2.3" };
let deviceOsVersion: string | null = "15";
let deviceManufacturer: string | null = "Samsung";
let deviceModelName: string | null = "SM-G991B";
vi.mock("expo-constants", () => ({ default: { get expoConfig() { return constantsConfig; } } }));
vi.mock("expo-device", () => ({
  get osVersion() { return deviceOsVersion; },
  get manufacturer() { return deviceManufacturer; },
  get modelName() { return deviceModelName; },
}));
vi.mock("./tracking-heartbeat", () => ({ normalizeBatteryState: () => ({ batteryPercentage: 90 }) }));
vi.mock("./tracking-health", () => ({ buildStartDayHealthChecklist: (...a: unknown[]) => buildStartDayHealthChecklist(...a) }));

beforeEach(() => {
  constantsConfig = { version: "1.2.3" };
  deviceOsVersion = "15"; deviceManufacturer = "Samsung"; deviceModelName = "SM-G991B";
  getForegroundPermissionsAsync.mockResolvedValue({ granted: true });
  getBackgroundPermissionsAsync.mockResolvedValue({ status: "denied" });
  getNotifPermissionsAsync.mockResolvedValue({ status: "undetermined" });
  hasServicesEnabledAsync.mockResolvedValue(true);
  getNetworkStateAsync.mockResolvedValue({ type: "WIFI", isConnected: true, isInternetReachable: true });
  getPowerStateAsync.mockResolvedValue({ batteryLevel: 0.9, batteryState: 2, lowPowerMode: false });
  isBatteryOptimizationEnabledAsync.mockResolvedValue(true);
});
afterEach(() => vi.clearAllMocks());

describe("getTrackingHeartbeatDeviceState", () => {
  it("maps permissions, network, battery and device metadata", async () => {
    const s = await getTrackingHeartbeatDeviceState();
    expect(s).toMatchObject({
      foregroundPermission: "granted",
      backgroundPermission: "denied",
      notificationPermission: "undetermined",
      isLocationEnabled: true,
      batteryOptimizationStatus: "optimized",
      networkType: "WIFI",
      isConnected: true,
      appVersion: "1.2.3",
      androidVersion: "15",
      manufacturer: "Samsung",
      model: "SM-G991B",
      batteryPercentage: 90,
    });
  });

  it("falls back to null/unknown when every probe fails", async () => {
    for (const fn of [getForegroundPermissionsAsync, getBackgroundPermissionsAsync, getNotifPermissionsAsync, hasServicesEnabledAsync, getNetworkStateAsync, getPowerStateAsync, isBatteryOptimizationEnabledAsync]) {
      fn.mockRejectedValue(new Error("x"));
    }
    constantsConfig = null; // expoConfig?.version → null
    deviceOsVersion = null; deviceManufacturer = null; deviceModelName = null;
    const s = await getTrackingHeartbeatDeviceState();
    expect(s).toMatchObject({
      foregroundPermission: "unknown",
      isLocationEnabled: null,
      batteryOptimizationStatus: null,
      networkType: null,
      isConnected: null,
      appVersion: null,
      androidVersion: null,
      manufacturer: null,
      model: null,
    });
  });

  it("treats an unknown permission status as unknown, empty network type as null, no-internet as offline", async () => {
    getForegroundPermissionsAsync.mockResolvedValue({ status: "weird" });
    getNetworkStateAsync.mockResolvedValue({ type: "", isConnected: true, isInternetReachable: false });
    isBatteryOptimizationEnabledAsync.mockResolvedValue(false);
    const s = await getTrackingHeartbeatDeviceState();
    expect(s.foregroundPermission).toBe("unknown");
    expect(s.networkType).toBeNull();
    expect(s.isConnected).toBe(false);
    expect(s.batteryOptimizationStatus).toBe("unrestricted");
  });
});

describe("getStartDayHealthChecklist", () => {
  it("builds the checklist from the device state", async () => {
    const out = await getStartDayHealthChecklist();
    expect(buildStartDayHealthChecklist).toHaveBeenCalledWith(
      expect.objectContaining({ isLocationEnabled: true, foregroundPermission: "granted" }),
    );
    expect(out).toEqual({ ready: true });
  });

  it("passes a null battery-optimization status through to the checklist", async () => {
    isBatteryOptimizationEnabledAsync.mockResolvedValue(null);
    await getStartDayHealthChecklist();
    expect(buildStartDayHealthChecklist).toHaveBeenCalledWith(
      expect.objectContaining({ batteryOptimizationStatus: null }),
    );
  });
});
