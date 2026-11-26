import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  appCb: null as null | ((s: string) => void),
  intervalCb: null as null | (() => void),
  reconcileCfg: null as null | Record<string, (...a: unknown[]) => unknown>,
}));
const apiFetch = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve({ activeSession: null }));
const getItemAsync = vi.fn<(k: string) => Promise<string | null>>(() => Promise.resolve(null));
const getBackgroundPermissionsAsync = vi.fn<() => Promise<{ granted: boolean } | null>>(() => Promise.resolve({ granted: false }));
const readSeStopHour = vi.fn<() => Promise<number>>(() => Promise.resolve(19));
const startNativeForegroundTracking = vi.fn<() => Promise<boolean>>(() => Promise.resolve(false));
const startBackgroundUpdates = vi.fn<() => Promise<boolean>>(() => Promise.resolve(true));
const setClientSessionId = vi.fn();
const isDayTracking = vi.fn<() => Promise<boolean>>(() => Promise.resolve(false));
const stopDayTracking = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const reconcileServerTrackingSession = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve({ recovered: false, reason: "active" }));
let istHourVal = 10;
let auth: { token: string | null; user: { role: string } | null } = { token: "tok", user: { role: "SALES_EXECUTIVE" } };

vi.mock("expo-location", () => ({ getBackgroundPermissionsAsync: () => getBackgroundPermissionsAsync() }));
vi.mock("expo-secure-store", () => ({ getItemAsync: (k: string) => getItemAsync(k) }));
vi.mock("react-native", () => ({ AppState: { addEventListener: (_e: string, cb: typeof h.appCb) => { h.appCb = cb; return { remove: vi.fn() }; } } }));
vi.mock("./api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("./auth", () => ({ useAuth: { getState: () => auth } }));
vi.mock("./day-flag", () => ({ istDate: () => "2026-08-05", istHour: () => istHourVal }));
vi.mock("./gps-config", () => ({ CLOSURE_RECOVERY_INTERVAL_MS: 180_000 }));
vi.mock("./gps-keys", () => ({ clientSessionKey: () => "CLI", dayOnKey: () => "ON", serverSessionKey: () => "SRV" }));
vi.mock("./gps-native", () => ({ readSeStopHour: () => readSeStopHour(), startNativeForegroundTracking: () => startNativeForegroundTracking() }));
vi.mock("./gps-recording", () => ({ startBackgroundUpdates: () => startBackgroundUpdates() }));
vi.mock("./gps-state", () => ({ setClientSessionId: (...a: unknown[]) => setClientSessionId(...a) }));
vi.mock("./gps-status", () => ({ isDayTracking: () => isDayTracking() }));
vi.mock("./gps-stop", () => ({ stopDayTracking: (...a: unknown[]) => stopDayTracking(...a) }));
vi.mock("./tracking-session-recovery", () => ({
  reconcileServerTrackingSession: (cfg: Record<string, (...a: unknown[]) => unknown>) => { h.reconcileCfg = cfg; return reconcileServerTrackingSession(cfg); },
}));

import { installGpsWatchdog, reconcileServerClosedTrackingSession } from "./gps-watchdog";

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.clearAllMocks();
  h.appCb = null; h.intervalCb = null; h.reconcileCfg = null;
  istHourVal = 10;
  auth = { token: "tok", user: { role: "SALES_EXECUTIVE" } };
  getItemAsync.mockResolvedValue(null);
  getBackgroundPermissionsAsync.mockResolvedValue({ granted: false });
  readSeStopHour.mockResolvedValue(19);
  startNativeForegroundTracking.mockResolvedValue(false);
  startBackgroundUpdates.mockResolvedValue(true);
  isDayTracking.mockResolvedValue(false);
  stopDayTracking.mockResolvedValue(undefined);
  apiFetch.mockResolvedValue({ activeSession: null });
  reconcileServerTrackingSession.mockResolvedValue({ recovered: false, reason: "active" });
  vi.spyOn(global, "setInterval").mockImplementation((cb: () => void) => { h.intervalCb = cb; return 0 as unknown as ReturnType<typeof setInterval>; });
});
afterEach(() => vi.restoreAllMocks());

describe("reconcileServerClosedTrackingSession", () => {
  it("does nothing without a token", async () => {
    auth = { token: null, user: null };
    await reconcileServerClosedTrackingSession();
    expect(reconcileServerTrackingSession).not.toHaveBeenCalled();
  });

  it("wires the recovery config and tolerates a reconcile failure", async () => {
    reconcileServerTrackingSession.mockRejectedValue(new Error("x"));
    await reconcileServerClosedTrackingSession();
    const cfg = h.reconcileCfg!;
    // isLocalTrackingOn: day-on today + a server session present → true
    getItemAsync.mockImplementation((k) => Promise.resolve(k === "ON" ? "2026-08-05" : "srv-1"));
    expect(await cfg.isLocalTrackingOn()).toBe(true);
    apiFetch.mockResolvedValue({ activeSession: { trackingSessionId: "s1" } });
    expect(await cfg.getActiveSession()).toEqual({ trackingSessionId: "s1" });
    await cfg.stopLocalTracking();
    expect(stopDayTracking).toHaveBeenCalledWith({ endServerSession: false });
    expect(cfg.clearAuthOnClosure).toBe(false);

    // isLocalTrackingOn tolerates failed SecureStore reads → false
    getItemAsync.mockRejectedValue(new Error("read"));
    expect(await cfg.isLocalTrackingOn()).toBe(false);
  });
});

describe("installGpsWatchdog", () => {
  it("tears down a leftover previous-day on startup and registers listeners", async () => {
    getItemAsync.mockResolvedValue("2026-08-04"); // stale day
    installGpsWatchdog();
    await flush();
    expect(stopDayTracking).toHaveBeenCalledWith({ endServerSession: false });
    expect(h.appCb).toBeTypeOf("function");
    expect(h.intervalCb).toBeTypeOf("function");
  });

  it("app-active with today's day + under the stop hour (re)starts the native service", async () => {
    getItemAsync.mockResolvedValue("2026-08-05");
    startNativeForegroundTracking.mockResolvedValue(true);
    installGpsWatchdog();
    await flush();
    stopDayTracking.mockClear();
    await h.appCb!("active");
    await flush();
    expect(startNativeForegroundTracking).toHaveBeenCalled();
    expect(startBackgroundUpdates).not.toHaveBeenCalled();
  });

  it("app-active past the SE stop hour tears tracking down", async () => {
    getItemAsync.mockResolvedValue("2026-08-05");
    istHourVal = 20; // past 19
    installGpsWatchdog();
    await flush();
    stopDayTracking.mockClear();
    await h.appCb!("active");
    await flush();
    expect(stopDayTracking).toHaveBeenCalledWith({ endServerSession: false });
    expect(startNativeForegroundTracking).not.toHaveBeenCalled();
  });

  it("app-active falls back to background updates when native fails and no day is tracking", async () => {
    getItemAsync.mockResolvedValue("2026-08-05");
    startNativeForegroundTracking.mockResolvedValue(false);
    isDayTracking.mockResolvedValue(false);
    getBackgroundPermissionsAsync.mockResolvedValue({ granted: true });
    installGpsWatchdog();
    await flush();
    await h.appCb!("active");
    await flush();
    expect(startBackgroundUpdates).toHaveBeenCalled();
  });

  it("ignores non-active app transitions", async () => {
    installGpsWatchdog();
    await flush();
    reconcileServerTrackingSession.mockClear();
    await h.appCb!("background");
    expect(reconcileServerTrackingSession).not.toHaveBeenCalled();
  });

  it("interval tears down a rolled-over day", async () => {
    installGpsWatchdog();
    await flush();
    getItemAsync.mockResolvedValue("2026-08-04");
    stopDayTracking.mockClear();
    await h.intervalCb!();
    await flush();
    expect(stopDayTracking).toHaveBeenCalledWith({ endServerSession: false });
  });

  it("interval reconciles when the day is current and under the stop hour", async () => {
    installGpsWatchdog();
    await flush();
    getItemAsync.mockResolvedValue("2026-08-05");
    reconcileServerTrackingSession.mockClear();
    await h.intervalCb!();
    await flush();
    expect(reconcileServerTrackingSession).toHaveBeenCalled();
  });

  it("interval tolerates a failed day-flag read and still reconciles", async () => {
    installGpsWatchdog();
    await flush();
    getItemAsync.mockRejectedValue(new Error("read")); // → caught → null day
    reconcileServerTrackingSession.mockClear();
    await h.intervalCb!();
    await flush();
    expect(reconcileServerTrackingSession).toHaveBeenCalled();
  });

  it("app-active tears down a rolled-over day", async () => {
    getItemAsync.mockResolvedValue("2026-08-04");
    installGpsWatchdog();
    await flush();
    stopDayTracking.mockClear();
    await h.appCb!("active");
    await flush();
    expect(stopDayTracking).toHaveBeenCalledWith({ endServerSession: false });
  });

  it("app-active with a non-SE role is never capped by the stop hour", async () => {
    auth = { token: "tok", user: { role: "LOGISTICS" } };
    istHourVal = 23; // would be past an SE hour, but Logistics has no cap
    getItemAsync.mockImplementation((k) => Promise.resolve(k === "ON" ? "2026-08-05" : "cs-1"));
    startNativeForegroundTracking.mockResolvedValue(true);
    installGpsWatchdog();
    await flush();
    await h.appCb!("active");
    await flush();
    expect(startNativeForegroundTracking).toHaveBeenCalled();
  });

  it("app-active tolerates session-read + permission failures", async () => {
    getItemAsync.mockImplementation((k) => (k === "ON" ? Promise.resolve("2026-08-05") : Promise.reject(new Error("read"))));
    getBackgroundPermissionsAsync.mockRejectedValue(new Error("perm"));
    isDayTracking.mockResolvedValue(false);
    installGpsWatchdog();
    await flush();
    await h.appCb!("active");
    await flush();
    expect(setClientSessionId).toHaveBeenCalledWith(null); // unreadable session → null
    expect(startBackgroundUpdates).not.toHaveBeenCalled(); // bg permission unreadable
  });

  it("app-active returns early when the day flag is absent/unreadable", async () => {
    getItemAsync.mockRejectedValue(new Error("read")); // → caught → null day
    installGpsWatchdog();
    await flush();
    stopDayTracking.mockClear();
    await h.appCb!("active");
    await flush();
    expect(startNativeForegroundTracking).not.toHaveBeenCalled();
    expect(stopDayTracking).not.toHaveBeenCalled();
  });

  it("app-active does nothing more when a day is already tracking", async () => {
    getItemAsync.mockImplementation((k) => Promise.resolve(k === "ON" ? "2026-08-05" : "cs-1"));
    startNativeForegroundTracking.mockResolvedValue(false);
    isDayTracking.mockResolvedValue(true);
    installGpsWatchdog();
    await flush();
    await h.appCb!("active");
    await flush();
    expect(startBackgroundUpdates).not.toHaveBeenCalled();
  });

  it("tolerates a failed startup day-flag read", async () => {
    getItemAsync.mockRejectedValue(new Error("read"));
    expect(() => installGpsWatchdog()).not.toThrow();
    await flush();
  });

  it("interval past the SE stop hour tears tracking down", async () => {
    getItemAsync.mockResolvedValue("2026-08-05");
    istHourVal = 20;
    installGpsWatchdog();
    await flush();
    stopDayTracking.mockClear();
    await h.intervalCb!();
    await flush();
    expect(stopDayTracking).toHaveBeenCalledWith({ endServerSession: false });
  });
});
