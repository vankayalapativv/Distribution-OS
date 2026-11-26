import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  netCb: null as null | ((s: { isConnected?: boolean | null; isInternetReachable?: boolean | null }) => void),
  appCb: null as null | ((status: string) => void),
  netRemove: vi.fn(),
  appRemove: vi.fn(),
}));
const kickSync = vi.fn();
const sendTrackingHeartbeatNow = vi.fn();
const getItemAsync = vi.fn<() => Promise<string | null>>(() => Promise.resolve("dayon"));
const dayFlagIsForToday = vi.fn<(...a: unknown[]) => boolean>(() => true);

vi.mock("expo-network", () => ({ addNetworkStateListener: (cb: typeof h.netCb) => { h.netCb = cb; return { remove: h.netRemove }; } }));
vi.mock("expo-secure-store", () => ({ getItemAsync: () => getItemAsync() }));
vi.mock("react-native", () => ({ AppState: { addEventListener: (_e: string, cb: typeof h.appCb) => { h.appCb = cb; return { remove: h.appRemove }; } } }));
vi.mock("./day-flag", () => ({ dayFlagIsForToday: (...a: unknown[]) => dayFlagIsForToday(...a) }));
vi.mock("./gps-keys", () => ({ dayOnKey: () => "dayon" }));
vi.mock("./sync-kick", () => ({ kickSync: () => kickSync() }));
vi.mock("./sync-heartbeat", () => ({ sendTrackingHeartbeatNow: () => sendTrackingHeartbeatNow() }));

async function load() {
  vi.resetModules();
  h.netCb = null; h.appCb = null;
  return import("./sync-engine");
}

beforeEach(() => { vi.useFakeTimers(); dayFlagIsForToday.mockReturnValue(true); getItemAsync.mockResolvedValue("dayon"); });
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe("startSyncEngine", () => {
  it("registers listeners + the heartbeat timer and kicks once; is idempotent", async () => {
    const m = await load();
    m.startSyncEngine();
    expect(h.netCb).toBeTypeOf("function");
    expect(h.appCb).toBeTypeOf("function");
    expect(kickSync).toHaveBeenCalledTimes(1);
    m.startSyncEngine(); // already started → no-op
    expect(kickSync).toHaveBeenCalledTimes(1);
  });

  it("kicks on network reconnect but not while disconnected", async () => {
    const m = await load();
    m.startSyncEngine();
    h.netCb!({ isConnected: true, isInternetReachable: true });
    expect(kickSync).toHaveBeenCalledTimes(2);
    h.netCb!({ isConnected: false });
    expect(kickSync).toHaveBeenCalledTimes(2);
  });

  it("kicks + heartbeats when the app becomes active (only)", async () => {
    const m = await load();
    m.startSyncEngine();
    h.appCb!("background");
    expect(sendTrackingHeartbeatNow).not.toHaveBeenCalled();
    h.appCb!("active");
    expect(sendTrackingHeartbeatNow).toHaveBeenCalledOnce();
  });

  it("heartbeats on the timer only while the day is on", async () => {
    const m = await load();
    m.startSyncEngine();
    await vi.advanceTimersByTimeAsync(3 * 60 * 1000);
    expect(getItemAsync).toHaveBeenCalled();
    expect(sendTrackingHeartbeatNow).toHaveBeenCalledOnce();

    dayFlagIsForToday.mockReturnValue(false);
    await vi.advanceTimersByTimeAsync(3 * 60 * 1000);
    expect(sendTrackingHeartbeatNow).toHaveBeenCalledOnce(); // unchanged — day is off
  });

  it("swallows a failed day-flag read on the timer", async () => {
    getItemAsync.mockRejectedValue(new Error("secure store"));
    const m = await load();
    m.startSyncEngine();
    await vi.advanceTimersByTimeAsync(3 * 60 * 1000); // no unhandled rejection
    expect(sendTrackingHeartbeatNow).not.toHaveBeenCalled();
  });
});

describe("stopSyncEngine", () => {
  it("tears down the timer and listeners; no-op when never started", async () => {
    const m = await load();
    m.stopSyncEngine(); // never started
    expect(h.netRemove).not.toHaveBeenCalled();

    m.startSyncEngine();
    m.stopSyncEngine();
    expect(h.netRemove).toHaveBeenCalledOnce();
    expect(h.appRemove).toHaveBeenCalledOnce();

    kickSync.mockClear();
    await vi.advanceTimersByTimeAsync(3 * 60 * 1000);
    expect(kickSync).not.toHaveBeenCalled(); // timer cleared
  });
});
