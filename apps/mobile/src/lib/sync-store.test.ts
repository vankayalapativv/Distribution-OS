import { afterEach, describe, expect, it, vi } from "vitest";
import { setSyncTrigger, useSyncStore } from "./sync-store";

const getLocalDb = vi.fn<() => unknown>();
const getQueueStats = vi.fn();
const retryFailedItems = vi.fn();
vi.mock("./db", () => ({ getLocalDb: () => getLocalDb() }));
vi.mock("./sync-core", () => ({
  getQueueStats: (...a: unknown[]) => getQueueStats(...a),
  retryFailedItems: (...a: unknown[]) => retryFailedItems(...a),
}));

afterEach(() => {
  vi.clearAllMocks();
  useSyncStore.setState({ pending: 0, failed: 0, syncing: false, lastSyncedAt: null });
  setSyncTrigger(() => {});
});

// Runs first (before any setSyncTrigger), so the module's default no-op trigger
// is the one invoked here.
it("retryFailed is safe before a sync trigger is registered", () => {
  getLocalDb.mockReturnValue({ id: "db" });
  getQueueStats.mockReturnValue({ pending: 0, failed: 0, syncing: false, lastSyncedAt: null });
  expect(() => useSyncStore.getState().retryFailed()).not.toThrow();
});

describe("useSyncStore.refreshStats", () => {
  it("writes the queue stats when a db is available", () => {
    getLocalDb.mockReturnValue({ id: "db" });
    getQueueStats.mockReturnValue({ pending: 3, failed: 1, syncing: false, lastSyncedAt: 5 });
    useSyncStore.getState().refreshStats();
    expect(useSyncStore.getState()).toMatchObject({ pending: 3, failed: 1, lastSyncedAt: 5 });
  });

  it("does nothing without a db", () => {
    getLocalDb.mockReturnValue(null);
    useSyncStore.getState().refreshStats();
    expect(getQueueStats).not.toHaveBeenCalled();
    expect(useSyncStore.getState().pending).toBe(0);
  });
});

describe("useSyncStore.retryFailed", () => {
  it("re-queues failed items, refreshes stats and triggers a sync", () => {
    const trigger = vi.fn();
    setSyncTrigger(trigger);
    getLocalDb.mockReturnValue({ id: "db" });
    getQueueStats.mockReturnValue({ pending: 2, failed: 0, syncing: false, lastSyncedAt: null });
    useSyncStore.getState().retryFailed();
    expect(retryFailedItems).toHaveBeenCalledWith({ id: "db" }, expect.any(Number));
    expect(useSyncStore.getState().pending).toBe(2);
    expect(trigger).toHaveBeenCalledOnce();
  });

  it("does nothing without a db", () => {
    const trigger = vi.fn();
    setSyncTrigger(trigger);
    getLocalDb.mockReturnValue(null);
    useSyncStore.getState().retryFailed();
    expect(retryFailedItems).not.toHaveBeenCalled();
    expect(trigger).not.toHaveBeenCalled();
  });
});
