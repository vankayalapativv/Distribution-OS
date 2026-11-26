import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLocationStatus, hasBackgroundLocationPermission, isDayTracking } from "./gps-status";

const getForegroundPermissionsAsync = vi.fn();
const getBackgroundPermissionsAsync = vi.fn();
const hasStartedLocationUpdatesAsync = vi.fn();
const getNativeTracking = vi.fn();
const dayEndedToday = vi.fn<() => Promise<boolean>>();
const dayStartedToday = vi.fn<() => Promise<boolean>>();
const getForegroundWatch = vi.fn();

vi.mock("expo-location", () => ({
  getForegroundPermissionsAsync: () => getForegroundPermissionsAsync(),
  getBackgroundPermissionsAsync: () => getBackgroundPermissionsAsync(),
  hasStartedLocationUpdatesAsync: (...a: unknown[]) => hasStartedLocationUpdatesAsync(...a),
}));
vi.mock("./gps-config", () => ({ GPS_TASK: "task" }));
vi.mock("./gps-native", () => ({ getNativeTracking: () => getNativeTracking() }));
vi.mock("./gps-session", () => ({ dayEndedToday: () => dayEndedToday(), dayStartedToday: () => dayStartedToday() }));
vi.mock("./gps-state", () => ({ getForegroundWatch: () => getForegroundWatch() }));

beforeEach(() => {
  dayEndedToday.mockResolvedValue(false);
  dayStartedToday.mockResolvedValue(true);
  getForegroundWatch.mockReturnValue(null);
  getNativeTracking.mockReturnValue(false);
  hasStartedLocationUpdatesAsync.mockResolvedValue(false);
});
afterEach(() => vi.clearAllMocks());

describe("hasBackgroundLocationPermission", () => {
  it("is true only when background is granted", async () => {
    getBackgroundPermissionsAsync.mockResolvedValue({ granted: true });
    expect(await hasBackgroundLocationPermission()).toBe(true);
    getBackgroundPermissionsAsync.mockResolvedValue({ granted: false });
    expect(await hasBackgroundLocationPermission()).toBe(false);
    getBackgroundPermissionsAsync.mockRejectedValue(new Error("x"));
    expect(await hasBackgroundLocationPermission()).toBe(false);
  });
});

describe("getLocationStatus", () => {
  it("off when foreground is not granted", async () => {
    getForegroundPermissionsAsync.mockResolvedValue({ granted: false });
    expect(await getLocationStatus()).toBe("off");
  });
  it("ready when background is granted", async () => {
    getForegroundPermissionsAsync.mockResolvedValue({ granted: true });
    getBackgroundPermissionsAsync.mockResolvedValue({ granted: true });
    expect(await getLocationStatus()).toBe("ready");
  });
  it("foreground_only when only foreground is granted", async () => {
    getForegroundPermissionsAsync.mockResolvedValue({ granted: true });
    getBackgroundPermissionsAsync.mockResolvedValue({ granted: false });
    expect(await getLocationStatus()).toBe("foreground_only");
  });
  it("treats permission-read failures as not granted", async () => {
    getForegroundPermissionsAsync.mockRejectedValue(new Error("x"));
    expect(await getLocationStatus()).toBe("off");
    getForegroundPermissionsAsync.mockResolvedValue({ granted: true });
    getBackgroundPermissionsAsync.mockRejectedValue(new Error("x"));
    expect(await getLocationStatus()).toBe("foreground_only");
  });
});

describe("isDayTracking", () => {
  it("is false once the day has been ended", async () => {
    dayEndedToday.mockResolvedValue(true);
    expect(await isDayTracking()).toBe(false);
  });
  it("is true while a foreground watch is active", async () => {
    getForegroundWatch.mockReturnValue({ remove: () => {} });
    expect(await isDayTracking()).toBe(true);
  });
  it("is false when the day was not started today", async () => {
    dayStartedToday.mockResolvedValue(false);
    expect(await isDayTracking()).toBe(false);
  });
  it("is true when the native task is tracking", async () => {
    getNativeTracking.mockReturnValue(true);
    expect(await isDayTracking()).toBe(true);
  });
  it("falls back to the registered background task state", async () => {
    hasStartedLocationUpdatesAsync.mockResolvedValue(true);
    expect(await isDayTracking()).toBe(true);
    hasStartedLocationUpdatesAsync.mockRejectedValue(new Error("x"));
    expect(await isDayTracking()).toBe(false);
  });
});
