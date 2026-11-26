import { afterEach, describe, expect, it, vi } from "vitest";
import { wipePreviousUserData } from "./auth-wipe";

const del = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const cancelAll = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const dismissAll = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const getLocalDb = vi.fn<() => unknown>(() => ({}));
const clearAllLocalData = vi.fn();
const clear = vi.fn();

vi.mock("./auth-storage", () => ({ storage: { del: (...a: unknown[]) => del(...a) } }));
vi.mock("expo-notifications", () => ({
  cancelAllScheduledNotificationsAsync: () => cancelAll(),
  dismissAllNotificationsAsync: () => dismissAll(),
}));
vi.mock("./db", () => ({ getLocalDb: () => getLocalDb() }));
vi.mock("./gps-config", () => ({
  scopedKeysFor: (id: string) => [`scoped:${id}:a`, `scoped:${id}:b`],
  LEGACY_UNSCOPED_KEYS: ["legacy-1"],
}));
vi.mock("./local-db", () => ({ clearAllLocalData: (...a: unknown[]) => clearAllLocalData(...a) }));
vi.mock("./query-client", () => ({ queryClient: { clear: () => clear() } }));

afterEach(() => {
  vi.clearAllMocks();
  getLocalDb.mockReturnValue({});
  del.mockReturnValue(Promise.resolve());
});

describe("wipePreviousUserData", () => {
  it("clears the prior user's scoped + legacy keys, notifications, db and query cache", async () => {
    const db = { id: "db" };
    getLocalDb.mockReturnValue(db);
    await wipePreviousUserData("userA");
    expect(del).toHaveBeenCalledWith("scoped:userA:a");
    expect(del).toHaveBeenCalledWith("scoped:userA:b");
    expect(del).toHaveBeenCalledWith("legacy-1");
    expect(cancelAll).toHaveBeenCalledOnce();
    expect(dismissAll).toHaveBeenCalledOnce();
    expect(clearAllLocalData).toHaveBeenCalledWith(db);
    expect(clear).toHaveBeenCalledOnce();
  });

  it("skips the db clear when there is no local db", async () => {
    getLocalDb.mockReturnValue(null);
    await wipePreviousUserData("userA");
    expect(clearAllLocalData).not.toHaveBeenCalled();
    expect(clear).toHaveBeenCalledOnce();
  });

  it("never throws when the db clear, a key delete, or a notification call fails", async () => {
    clearAllLocalData.mockImplementation(() => { throw new Error("db busy"); });
    del.mockReturnValueOnce(Promise.reject(new Error("locked")));
    cancelAll.mockReturnValueOnce(Promise.reject(new Error("notif")));
    dismissAll.mockReturnValueOnce(Promise.reject(new Error("notif")));
    await expect(wipePreviousUserData("userA")).resolves.toBeUndefined();
    expect(clear).toHaveBeenCalledOnce();
  });
});
