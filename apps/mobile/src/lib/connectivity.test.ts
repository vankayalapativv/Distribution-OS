import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let networkListener: (s: { isConnected?: boolean | null; isInternetReachable?: boolean | null }) => void = () => {};
const getNetworkStateAsync = vi.fn<() => Promise<unknown>>(() => Promise.resolve({ isConnected: true, isInternetReachable: true }));
const addNetworkStateListener = vi.fn((cb: typeof networkListener) => { networkListener = cb; });
vi.mock("expo-network", () => ({
  getNetworkStateAsync: () => getNetworkStateAsync(),
  addNetworkStateListener: (cb: typeof networkListener) => addNetworkStateListener(cb),
}));

async function load() {
  vi.resetModules();
  return import("./connectivity");
}

beforeEach(() => {
  networkListener = () => {};
  getNetworkStateAsync.mockResolvedValue({ isConnected: true, isInternetReachable: true });
});
afterEach(() => vi.clearAllMocks());

describe("connectivity", () => {
  it("starts the single network listener lazily on first read", async () => {
    const m = await load();
    expect(addNetworkStateListener).not.toHaveBeenCalled();
    expect(m.getIsOnline()).toBe(true); // optimistic default
    expect(addNetworkStateListener).toHaveBeenCalledOnce();
    m.getIsOnline(); // second read does not re-start
    expect(addNetworkStateListener).toHaveBeenCalledOnce();
  });

  it("notifies subscribers when connectivity flips, and unsubscribe stops them", async () => {
    const m = await load();
    const seen: boolean[] = [];
    const unsub = m.subscribeOnline((o) => seen.push(o));
    networkListener({ isConnected: false, isInternetReachable: false }); // → offline
    networkListener({ isConnected: true, isInternetReachable: true }); // → online
    networkListener({ isConnected: true, isInternetReachable: true }); // no change → no notify
    unsub();
    networkListener({ isConnected: false, isInternetReachable: false }); // after unsub → ignored
    expect(seen).toEqual([false, true]);
  });

  it("treats a connected network with no internet as offline", async () => {
    const m = await load();
    m.getIsOnline();
    networkListener({ isConnected: true, isInternetReachable: false });
    expect(m.getIsOnline()).toBe(false);
  });

  it("swallows a failed initial probe", async () => {
    getNetworkStateAsync.mockRejectedValue(new Error("no net api"));
    const m = await load();
    expect(() => m.getIsOnline()).not.toThrow();
  });
});
