import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, renderHook } from "@testing-library/react";
import { useDayTracking } from "./use-day-tracking";

const push = vi.fn();
const isDayTracking = vi.fn<() => Promise<boolean>>(() => Promise.resolve(false));
const dayEndedToday = vi.fn<() => Promise<boolean>>(() => Promise.resolve(false));
const markDayEndedToday = vi.fn<() => Promise<void>>(() => Promise.resolve());
const stopDayTracking = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const getServerStartOdometer = vi.fn<() => Promise<number | null>>(() => Promise.resolve(48000));
const getDayStartOdometer = vi.fn<() => Promise<number | null>>(() => Promise.resolve(47000));
const promptOdometer = vi.fn<(...a: unknown[]) => Promise<string | null>>(() => Promise.resolve("48210"));
const runStartDayFlow = vi.fn<(...a: unknown[]) => Promise<boolean>>(() => Promise.resolve(true));

let appStateHandler: (s: string) => void = () => undefined;
vi.mock("react-native", () => ({ AppState: { addEventListener: (_e: string, cb: (s: string) => void) => { appStateHandler = cb; return { remove: vi.fn() }; } } }));
vi.mock("expo-router", () => ({ router: { push: (...a: unknown[]) => push(...a) }, useFocusEffect: (cb: () => void) => React.useEffect(cb, [cb]) }));
vi.mock("./gps", () => ({
  dayEndedToday: () => dayEndedToday(), isDayTracking: () => isDayTracking(),
  markDayEndedToday: () => markDayEndedToday(), stopDayTracking: (...a: unknown[]) => stopDayTracking(...a),
}));
vi.mock("./gps-session", () => ({ getDayStartOdometer: () => getDayStartOdometer(), getServerStartOdometer: () => getServerStartOdometer() }));
vi.mock("./odometer-prompt", () => ({ promptOdometer: (...a: unknown[]) => promptOdometer(...a), MIN_DAY_DISTANCE_KM: 1, MAX_DAY_DISTANCE_KM: 500 }));
vi.mock("./start-day-flow", () => ({ runStartDayFlow: (...a: unknown[]) => runStartDayFlow(...a) }));

const confirm = vi.fn<(...a: unknown[]) => Promise<boolean>>(() => Promise.resolve(true));
const prompt = vi.fn();
const dialog = { confirm, prompt };
const setup = () => renderHook(() => useDayTracking(dialog));
beforeEach(() => {
  isDayTracking.mockResolvedValue(false); dayEndedToday.mockResolvedValue(false);
  getServerStartOdometer.mockResolvedValue(48000); promptOdometer.mockResolvedValue("48210");
  runStartDayFlow.mockResolvedValue(true); confirm.mockResolvedValue(true);
});
afterEach(() => vi.clearAllMocks());

describe("useDayTracking state", () => {
  it("reads the day flags on mount", async () => {
    isDayTracking.mockResolvedValue(true);
    const { result } = setup();
    await act(async () => { await Promise.resolve(); });
    expect(result.current.dayOn).toBe(true);
    expect(result.current.dayEnded).toBe(false);
  });
});

describe("useDayTracking.onStartDay", () => {
  it("starts the day and opens the beat on success", async () => {
    isDayTracking.mockResolvedValue(true); // the day is tracking after a successful start
    const { result } = setup();
    await act(async () => { await Promise.resolve(); }); // settle the mount recheck
    await act(async () => { await result.current.onStartDay(); });
    expect(result.current.dayOn).toBe(true);
    expect(push).toHaveBeenCalledWith("/beat");
    expect(result.current.dayBusy).toBe(false);
  });
  it("stays off when the start flow aborts", async () => {
    runStartDayFlow.mockResolvedValue(false);
    const { result } = setup();
    await act(async () => { await result.current.onStartDay(); });
    expect(result.current.dayOn).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });
});

describe("useDayTracking.onEndDay", () => {
  it("ends the day with the odometer, preferring the server start reading", async () => {
    const { result } = setup();
    await act(async () => { await result.current.onEndDay(); });
    expect(promptOdometer).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ greaterThan: 48000 }));
    expect(stopDayTracking).toHaveBeenCalledWith({ endOdometer: "48210" });
    expect(markDayEndedToday).toHaveBeenCalled();
    expect(result.current.dayEnded).toBe(true);
  });
  it("falls back to the device start reading when the server has none", async () => {
    getServerStartOdometer.mockResolvedValue(null);
    const { result } = setup();
    await act(async () => { await result.current.onEndDay(); });
    expect(promptOdometer).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ greaterThan: 47000 }));
  });
  it("does nothing when the end is cancelled", async () => {
    confirm.mockResolvedValue(false);
    const { result } = setup();
    await act(async () => { await result.current.onEndDay(); });
    expect(stopDayTracking).not.toHaveBeenCalled();
  });
  it("does not stop tracking when the odometer prompt is cancelled", async () => {
    promptOdometer.mockResolvedValue(null);
    const { result } = setup();
    await act(async () => { await result.current.onEndDay(); });
    expect(stopDayTracking).not.toHaveBeenCalled();
  });
});

describe("useDayTracking polling + lifecycle", () => {
  it("re-checks on the 60s interval while the day is on", async () => {
    vi.useFakeTimers();
    isDayTracking.mockResolvedValue(true);
    setup();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    isDayTracking.mockClear();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(isDayTracking).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("re-checks on app foreground, ignores other states", async () => {
    setup();
    await act(async () => { await Promise.resolve(); });
    isDayTracking.mockClear();
    act(() => appStateHandler("active"));
    await act(async () => { await Promise.resolve(); });
    expect(isDayTracking).toHaveBeenCalled();
    isDayTracking.mockClear();
    act(() => appStateHandler("background"));
    expect(isDayTracking).not.toHaveBeenCalled();
  });

  it("drops a recheck that resolves after unmount", async () => {
    let release!: () => void;
    isDayTracking.mockReturnValue(new Promise((r) => { release = () => r(true); }));
    const { unmount, result } = setup();
    unmount();
    await act(async () => { release(); await Promise.resolve(); });
    expect(result.current.dayOn).toBe(false); // guarded setState skipped
  });

  it("skips the end-day setState when unmounted mid-stop", async () => {
    let release!: () => void;
    stopDayTracking.mockReturnValue(new Promise((r) => { release = () => r(); }));
    const { unmount, result } = setup();
    await act(async () => { await Promise.resolve(); });
    let p!: Promise<void>;
    act(() => { p = result.current.onEndDay(); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    unmount();
    await act(async () => { release(); await p; });
    expect(result.current.dayEnded).toBe(false);
  });
});
