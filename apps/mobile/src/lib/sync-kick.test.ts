import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const flushGpsPings = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve({ sent: 0 }));
const flushOnce = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve({ sent: 0, failed: 0, deferred: 0 }));
const getQueueStats = vi.fn<(...a: unknown[]) => unknown>(() => ({ pending: 1, failed: 0, syncing: false, lastSyncedAt: null }));
const prefetchReadData = vi.fn(() => Promise.resolve());
const sendItem = vi.fn();
const sendGpsBatch = vi.fn();
const sendTrackingHeartbeatNow = vi.fn(() => Promise.resolve({ sent: true }));
const setState = vi.fn();
let token: string | null = "tok";
const getLocalDb = vi.fn<() => unknown>(() => ({ id: "db" }));

vi.mock("./auth", () => ({ useAuth: { getState: () => ({ token }) } }));
vi.mock("./db", () => ({ getLocalDb: () => getLocalDb() }));
vi.mock("./sync-core", () => ({
  flushGpsPings: (...a: unknown[]) => flushGpsPings(...a),
  flushOnce: (...a: unknown[]) => flushOnce(...a),
  getQueueStats: (...a: unknown[]) => getQueueStats(...a),
}));
vi.mock("./sync-core-prefetch", () => ({ prefetchReadData: () => prefetchReadData() }));
vi.mock("./sync-send", () => ({ sendItem: (...a: unknown[]) => sendItem(...a) }));
vi.mock("./sync-tracking-session", () => ({ sendGpsBatch: (...a: unknown[]) => sendGpsBatch(...a) }));
vi.mock("./sync-heartbeat", () => ({ sendTrackingHeartbeatNow: () => sendTrackingHeartbeatNow() }));
const trig = vi.hoisted(() => ({ fn: null as null | (() => void) }));
vi.mock("./sync-store", () => ({
  useSyncStore: { setState: (...a: unknown[]) => setState(...a) },
  setSyncTrigger: (fn: () => void) => { trig.fn = fn; },
}));

async function load() { vi.resetModules(); return import("./sync-kick"); }

beforeEach(() => {
  token = "tok";
  getLocalDb.mockReturnValue({ id: "db" });
  flushGpsPings.mockResolvedValue({ sent: 0 });
});
afterEach(() => vi.clearAllMocks());

describe("kickSync", () => {
  it("does nothing without a token or a db", async () => {
    token = null;
    let m = await load();
    await m.kickSync();
    token = "tok"; getLocalDb.mockReturnValue(null);
    m = await load();
    await m.kickSync();
    expect(flushGpsPings).not.toHaveBeenCalled();
  });

  it("flushes gps + the write-queue, heartbeats, prefetches and toggles syncing", async () => {
    const m = await load();
    await m.kickSync();
    expect(flushGpsPings).toHaveBeenCalledWith({ id: "db" }, expect.any(Function));
    expect(flushOnce).toHaveBeenCalledWith({ id: "db" }, { send: expect.any(Function) }, expect.any(Number));
    expect(sendTrackingHeartbeatNow).toHaveBeenCalled();
    expect(prefetchReadData).toHaveBeenCalled();
    expect(setState).toHaveBeenCalledWith({ syncing: true });
    expect(setState).toHaveBeenCalledWith({ syncing: false });
  });

  it("coalesces a concurrent kick onto the in-flight flush", async () => {
    let release!: () => void;
    flushGpsPings.mockReturnValue(new Promise((r) => { release = () => r({ sent: 0 }); }));
    const m = await load();
    const first = m.kickSync();
    const second = m.kickSync(); // in flight → same promise
    expect(flushGpsPings).toHaveBeenCalledOnce();
    release();
    await Promise.all([first, second]);
  });

  it("registers a sync trigger that kicks a flush", async () => {
    await load();
    expect(trig.fn).toBeTypeOf("function");
    trig.fn!();
    await Promise.resolve();
    expect(flushGpsPings).toHaveBeenCalled();
  });

  it("starts a fresh flush if the previous one looks wedged", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    let release!: () => void;
    flushGpsPings.mockReturnValueOnce(new Promise((r) => { release = () => r({ sent: 0 }); }));
    const m = await load();
    const first = m.kickSync();
    vi.setSystemTime(100_000); // > FLUSH_STUCK_MS (90s)
    const second = m.kickSync(); // not coalesced → new flush
    expect(flushGpsPings).toHaveBeenCalledTimes(2);
    release();
    await Promise.all([first, second]);
    vi.useRealTimers();
  });
});
