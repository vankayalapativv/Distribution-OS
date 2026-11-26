import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useLocationGuard } from "./use-location-guard";

const h = vi.hoisted(() => {
  const authState = { user: { role: "SALES_EXECUTIVE" as string | null } };
  const useAuth = (sel: (s: typeof authState) => unknown) => sel(authState);
  const initialGuardState = { blocked: false, reason: null as string | null };
  const reduceGuard = vi.fn((_s: unknown, reason: string | null) => ({ blocked: reason === "blocked", reason }));
  return { authState, useAuth, initialGuardState, reduceGuard };
});
const isDayTracking = vi.fn<() => Promise<boolean>>(() => Promise.resolve(true));
const evaluateLocationHealth = vi.fn<(...a: unknown[]) => string | null>(() => null);
const getTrackingHeartbeatDeviceState = vi.fn<() => Promise<unknown>>(() => Promise.resolve({ isLocationEnabled: true, foregroundPermission: "granted", backgroundPermission: "granted" }));
let appStateHandler: (s: string) => void = () => undefined;

vi.mock("react-native", () => ({ AppState: { addEventListener: (_e: string, cb: (s: string) => void) => { appStateHandler = cb; return { remove: vi.fn() }; } } }));
vi.mock("./auth", () => ({ useAuth: h.useAuth }));
vi.mock("./gps", () => ({ isDayTracking: () => isDayTracking() }));
vi.mock("./location-health", () => ({ evaluateLocationHealth: (...a: unknown[]) => evaluateLocationHealth(...a) }));
vi.mock("./location-guard-state", () => ({ initialGuardState: h.initialGuardState, reduceGuard: (...a: [unknown, string | null]) => h.reduceGuard(...a) }));
vi.mock("./sync", () => ({ getTrackingHeartbeatDeviceState: () => getTrackingHeartbeatDeviceState() }));

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
beforeEach(() => {
  h.authState.user = { role: "SALES_EXECUTIVE" };
  isDayTracking.mockResolvedValue(true);
  evaluateLocationHealth.mockReturnValue(null);
  getTrackingHeartbeatDeviceState.mockResolvedValue({ isLocationEnabled: true, foregroundPermission: "granted", backgroundPermission: "granted" });
});
afterEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });

describe("useLocationGuard", () => {
  it("does nothing for a non-field role (recheck is a no-op)", async () => {
    h.authState.user = { role: "SUPER_ADMIN" };
    const { result } = renderHook(() => useLocationGuard());
    await flush();
    act(() => result.current.recheck()); // the initial no-op ref — never runs a check
    await flush();
    expect(isDayTracking).not.toHaveBeenCalled();
    expect(result.current.blocked).toBe(false);
  });

  it("ignores a re-entrant check while one is already running", async () => {
    let release!: () => void;
    getTrackingHeartbeatDeviceState.mockReturnValue(new Promise((r) => { release = () => r({ isLocationEnabled: true, foregroundPermission: "granted", backgroundPermission: "granted" }); }));
    renderHook(() => useLocationGuard());
    await act(async () => { await Promise.resolve(); }); // first check in flight (running)
    getTrackingHeartbeatDeviceState.mockClear();
    act(() => appStateHandler("active")); // re-entrant → guarded
    expect(getTrackingHeartbeatDeviceState).not.toHaveBeenCalled();
    await act(async () => { release(); await Promise.resolve(); });
  });

  it("stops cleanly when unmounted mid-check", async () => {
    let release!: () => void;
    getTrackingHeartbeatDeviceState.mockReturnValue(new Promise((r) => { release = () => r({ isLocationEnabled: true, foregroundPermission: "granted", backgroundPermission: "granted" }); }));
    const { unmount } = renderHook(() => useLocationGuard());
    await act(async () => { await Promise.resolve(); });
    unmount(); // cancelled = true
    await act(async () => { release(); await Promise.resolve(); await Promise.resolve(); });
    expect(h.reduceGuard).not.toHaveBeenCalled(); // bailed at the post-read cancelled check
  });

  it("resets to the initial state when the day isn't tracking", async () => {
    isDayTracking.mockResolvedValue(false);
    const { result } = renderHook(() => useLocationGuard());
    await flush();
    expect(result.current.blocked).toBe(false);
    expect(h.reduceGuard).not.toHaveBeenCalled(); // no reading taken while inactive
  });

  it("evaluates location health while tracking (healthy → not blocked)", async () => {
    const { result } = renderHook(() => useLocationGuard());
    await flush();
    expect(getTrackingHeartbeatDeviceState).toHaveBeenCalled();
    expect(h.reduceGuard).toHaveBeenCalledWith(expect.anything(), null);
    expect(result.current.blocked).toBe(false);
  });

  it("blocks on a confirmed bad reading", async () => {
    evaluateLocationHealth.mockReturnValue("blocked");
    const { result } = renderHook(() => useLocationGuard());
    await flush();
    expect(result.current.blocked).toBe(true);
    expect(result.current.reason).toBe("blocked");
  });

  it("re-checks faster (burst) while confirming a bad-but-unblocked reading", async () => {
    vi.useFakeTimers();
    evaluateLocationHealth.mockReturnValue("bad"); // reason present, reduceGuard → not blocked
    renderHook(() => useLocationGuard());
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    getTrackingHeartbeatDeviceState.mockClear();
    await act(async () => { await vi.advanceTimersByTimeAsync(500); }); // burst interval
    expect(getTrackingHeartbeatDeviceState).toHaveBeenCalled();
  });

  it("re-checks on the slow idle tick when healthy", async () => {
    vi.useFakeTimers();
    renderHook(() => useLocationGuard());
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    isDayTracking.mockClear();
    await act(async () => { await vi.advanceTimersByTimeAsync(12_000); });
    expect(isDayTracking).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("re-checks on app foreground and via the exposed recheck()", async () => {
    const { result } = renderHook(() => useLocationGuard());
    await flush();
    isDayTracking.mockClear();
    act(() => appStateHandler("active"));
    await flush();
    expect(isDayTracking).toHaveBeenCalled();
    isDayTracking.mockClear();
    act(() => appStateHandler("inactive")); // ignored
    expect(isDayTracking).not.toHaveBeenCalled();
    act(() => result.current.recheck());
    await flush();
    expect(isDayTracking).toHaveBeenCalled();
  });

  it("never flips state when a device-state read throws", async () => {
    getTrackingHeartbeatDeviceState.mockRejectedValue(new Error("device read failed"));
    const { result } = renderHook(() => useLocationGuard());
    await flush();
    expect(result.current.blocked).toBe(false);
  });
});
