import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  canScheduleExactAlarms, isIgnoringBatteryOptimizations, openAutostartSettings,
  openExactAlarmSettings, requestIgnoreBatteryOptimizations,
} from "./permissions-native";

const h = vi.hoisted(() => ({ platform: { OS: "android" }, modules: { NativeTracking: {} as Record<string, unknown> } }));
vi.mock("react-native", () => ({ get Platform() { return h.platform; }, get NativeModules() { return h.modules; } }));

beforeEach(() => { h.platform.OS = "android"; h.modules.NativeTracking = {}; });
afterEach(() => vi.clearAllMocks());

describe("permissions-native — degrades safely off-Android / without the module", () => {
  it("treats battery + exact-alarm as satisfied on iOS", async () => {
    h.platform.OS = "ios";
    expect(await isIgnoringBatteryOptimizations()).toBe(true);
    expect(await canScheduleExactAlarms()).toBe(true);
    await expect(requestIgnoreBatteryOptimizations()).resolves.toBeUndefined();
    await expect(openExactAlarmSettings()).resolves.toBeUndefined();
    await expect(openAutostartSettings()).resolves.toBeUndefined();
  });
  it("treats permissions as satisfied when the native module is absent", async () => {
    h.modules.NativeTracking = undefined as never;
    expect(await isIgnoringBatteryOptimizations()).toBe(true);
    expect(await canScheduleExactAlarms()).toBe(true);
  });
});

describe("permissions-native — delegates to the native module", () => {
  it("returns the native battery + alarm answers", async () => {
    h.modules.NativeTracking = {
      isIgnoringBatteryOptimizations: vi.fn(() => Promise.resolve(false)),
      canScheduleExactAlarms: vi.fn(() => Promise.resolve(false)),
      requestIgnoreBatteryOptimizations: vi.fn(() => Promise.resolve(true)),
      openExactAlarmSettings: vi.fn(() => Promise.resolve(true)),
      openAutostartSettings: vi.fn(() => Promise.resolve(true)),
    };
    expect(await isIgnoringBatteryOptimizations()).toBe(false);
    expect(await canScheduleExactAlarms()).toBe(false);
    await requestIgnoreBatteryOptimizations();
    await openExactAlarmSettings();
    await openAutostartSettings();
    expect((h.modules.NativeTracking.openAutostartSettings as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
  });
  it("swallows native rejections, defaulting to satisfied", async () => {
    h.modules.NativeTracking = {
      isIgnoringBatteryOptimizations: vi.fn(() => Promise.reject(new Error("x"))),
      canScheduleExactAlarms: vi.fn(() => Promise.reject(new Error("x"))),
      requestIgnoreBatteryOptimizations: vi.fn(() => Promise.reject(new Error("x"))),
      openExactAlarmSettings: vi.fn(() => Promise.reject(new Error("x"))),
      openAutostartSettings: vi.fn(() => Promise.reject(new Error("x"))),
    };
    expect(await isIgnoringBatteryOptimizations()).toBe(true);
    expect(await canScheduleExactAlarms()).toBe(true);
    await expect(requestIgnoreBatteryOptimizations()).resolves.toBeUndefined();
    await expect(openExactAlarmSettings()).resolves.toBeUndefined();
    await expect(openAutostartSettings()).resolves.toBeUndefined();
  });
});
