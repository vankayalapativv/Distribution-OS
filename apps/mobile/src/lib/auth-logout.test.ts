import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logout } from "./auth-logout";

const apiFetch = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
vi.mock("./api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));

const storageGet = vi.fn();
const storageDel = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
vi.mock("./auth-storage", () => ({
  storage: { get: (...a: unknown[]) => storageGet(...a), del: (...a: unknown[]) => storageDel(...a) },
  TOKEN_KEY: "TOKEN",
  USER_KEY: "USER",
  SESSION_KEY: "SESSION",
}));

const getLocalDb = vi.fn<() => unknown>();
vi.mock("./db", () => ({ getLocalDb: () => getLocalDb() }));
const clearAllLocalData = vi.fn();
vi.mock("./local-db", () => ({ clearAllLocalData: (...a: unknown[]) => clearAllLocalData(...a) }));
const neonSignOut = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
vi.mock("./neon-auth", () => ({ neonSignOut: (...a: unknown[]) => neonSignOut(...a) }));
const clear = vi.fn();
vi.mock("./query-client", () => ({ queryClient: { clear: () => clear() } }));
const cancelAll = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const dismissAll = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
vi.mock("expo-notifications", () => ({
  cancelAllScheduledNotificationsAsync: () => cancelAll(),
  dismissAllNotificationsAsync: () => dismissAll(),
}));
const setNativeSignedIn = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const stopDayTracking = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
vi.mock("./gps", () => ({
  setNativeSignedIn: (...a: unknown[]) => setNativeSignedIn(...a),
  stopDayTracking: (...a: unknown[]) => stopDayTracking(...a),
}));

function stubStorage(over: Record<string, string | null> = {}) {
  const base: Record<string, string | null> = {
    TOKEN: "tok",
    USER: JSON.stringify({ role: "SALES_EXECUTIVE" }),
    SESSION: "sess",
    ...over,
  };
  storageGet.mockImplementation((key: string) => Promise.resolve(base[key] ?? null));
}

beforeEach(() => {
  stubStorage();
  getLocalDb.mockReturnValue({ id: "db" });
});

afterEach(() => vi.clearAllMocks());

describe("logout", () => {
  it("stops tracking, beacons, clears caches/session and resets the store", async () => {
    const set = vi.fn();
    await logout(set);
    expect(setNativeSignedIn).toHaveBeenCalledWith(false);
    expect(stopDayTracking).toHaveBeenCalledWith({ endServerSession: false });
    expect(apiFetch).toHaveBeenCalledWith("/tracking-sessions/signed-out", { method: "POST", token: "tok" });
    expect(cancelAll).toHaveBeenCalledOnce();
    expect(clearAllLocalData).toHaveBeenCalledWith({ id: "db" });
    expect(clear).toHaveBeenCalledOnce();
    expect(neonSignOut).toHaveBeenCalledWith("sess");
    expect(storageDel).toHaveBeenCalledWith("TOKEN");
    expect(storageDel).toHaveBeenCalledWith("SESSION");
    expect(set).toHaveBeenCalledWith({ token: null, user: null });
  });

  it("also beacons for a LOGISTICS role", async () => {
    stubStorage({ USER: JSON.stringify({ role: "LOGISTICS" }) });
    await logout(vi.fn());
    expect(apiFetch).toHaveBeenCalledOnce();
  });

  it("skips the beacon for a non-field role", async () => {
    stubStorage({ USER: JSON.stringify({ role: "SUPER_ADMIN" }) });
    await logout(vi.fn());
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("skips the beacon when there is no token (and no cached user)", async () => {
    stubStorage({ TOKEN: null, USER: null });
    await logout(vi.fn());
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("skips the db clear when there is no local db", async () => {
    getLocalDb.mockReturnValue(null);
    await logout(vi.fn());
    expect(clearAllLocalData).not.toHaveBeenCalled();
  });

  it("skips the Neon revoke when there is no stored session", async () => {
    stubStorage({ SESSION: null });
    await logout(vi.fn());
    expect(neonSignOut).not.toHaveBeenCalled();
  });

  it("completes despite failures in tracking-stop, beacon, cache-clear and revoke", async () => {
    setNativeSignedIn.mockRejectedValue(new Error("native"));
    apiFetch.mockRejectedValue(new Error("offline"));
    cancelAll.mockRejectedValue(new Error("notif"));
    dismissAll.mockRejectedValue(new Error("notif"));
    clearAllLocalData.mockImplementation(() => { throw new Error("db busy"); });
    neonSignOut.mockRejectedValue(new Error("revoke"));
    const set = vi.fn();
    await expect(logout(set)).resolves.toBeUndefined();
    expect(set).toHaveBeenCalledWith({ token: null, user: null });
  });
});
