import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bringUpTracking } from "./gps-bring-up";

const getCurrentPositionAsync = vi.fn<() => Promise<unknown>>(() => Promise.resolve({ coords: {} }));
const requestBackgroundPermissionsAsync = vi.fn<() => Promise<{ granted: boolean }>>(() => Promise.resolve({ granted: false }));
const watchPositionAsync = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve({ remove: vi.fn() }));
const startNativeForegroundTracking = vi.fn<() => Promise<boolean>>(() => Promise.resolve(false));
const startBackgroundUpdates = vi.fn<() => Promise<boolean>>(() => Promise.resolve(false));
const recordLocations = vi.fn();
const setForegroundWatch = vi.fn();
let foregroundWatch: { remove: () => void } | null = null;

vi.mock("expo-location", () => ({
  getCurrentPositionAsync: () => getCurrentPositionAsync(),
  requestBackgroundPermissionsAsync: () => requestBackgroundPermissionsAsync(),
  watchPositionAsync: (...a: unknown[]) => watchPositionAsync(...a),
  Accuracy: { High: 5 },
}));
vi.mock("./gps-config", () => ({ PING_INTERVAL_MS: 180_000, withTimeout: (p: Promise<unknown>, _ms: number, fb: unknown) => Promise.resolve(p).catch(() => fb) }));
vi.mock("./gps-native", () => ({ startNativeForegroundTracking: () => startNativeForegroundTracking() }));
vi.mock("./gps-recording", () => ({ recordLocations: (...a: unknown[]) => recordLocations(...a), startBackgroundUpdates: () => startBackgroundUpdates() }));
vi.mock("./gps-state", () => ({ getForegroundWatch: () => foregroundWatch, setForegroundWatch: (...a: unknown[]) => setForegroundWatch(...a) }));

beforeEach(() => {
  foregroundWatch = null;
  getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 1, longitude: 2 } });
  startNativeForegroundTracking.mockResolvedValue(false);
  requestBackgroundPermissionsAsync.mockResolvedValue({ granted: false });
  startBackgroundUpdates.mockResolvedValue(false);
  watchPositionAsync.mockResolvedValue({ remove: vi.fn() });
});
afterEach(() => vi.clearAllMocks());

describe("bringUpTracking", () => {
  it("records the first fix then stops at the native foreground service", async () => {
    startNativeForegroundTracking.mockResolvedValue(true);
    await bringUpTracking("cs-1");
    expect(recordLocations).toHaveBeenCalledWith([{ coords: { latitude: 1, longitude: 2 } }]);
    expect(startBackgroundUpdates).not.toHaveBeenCalled();
    expect(watchPositionAsync).not.toHaveBeenCalled();
  });

  it("skips recording when there is no first fix", async () => {
    getCurrentPositionAsync.mockResolvedValue(null);
    startNativeForegroundTracking.mockResolvedValue(true);
    await bringUpTracking("cs-1");
    expect(recordLocations).not.toHaveBeenCalled();
  });

  it("falls back to expo background updates when granted", async () => {
    requestBackgroundPermissionsAsync.mockResolvedValue({ granted: true });
    startBackgroundUpdates.mockResolvedValue(true);
    await bringUpTracking("cs-1");
    expect(watchPositionAsync).not.toHaveBeenCalled();
  });

  it("falls back to a foreground watcher, replacing any existing one", async () => {
    const remove = vi.fn();
    foregroundWatch = { remove };
    const sub = { remove: vi.fn() };
    watchPositionAsync.mockResolvedValue(sub);
    await bringUpTracking("cs-1");
    expect(remove).toHaveBeenCalled();
    expect(setForegroundWatch).toHaveBeenCalledWith(sub);
  });

  it("forwards foreground-watch fixes to recordLocations", async () => {
    await bringUpTracking("cs-1");
    const cb = watchPositionAsync.mock.calls.at(-1)![1] as (l: unknown) => void;
    recordLocations.mockClear();
    cb({ coords: {} });
    expect(recordLocations).toHaveBeenCalledWith([{ coords: {} }]);
  });

  it("swallows a transport-start failure", async () => {
    watchPositionAsync.mockRejectedValue(new Error("restricted"));
    await expect(bringUpTracking("cs-1")).resolves.toBeUndefined();
  });

  it("tolerates first-fix and background-permission read failures", async () => {
    getCurrentPositionAsync.mockRejectedValue(new Error("gps")); // → caught → null
    requestBackgroundPermissionsAsync.mockRejectedValue(new Error("perm")); // → caught → null
    await bringUpTracking("cs-1");
    expect(recordLocations).not.toHaveBeenCalled(); // no first fix
    expect(watchPositionAsync).toHaveBeenCalled(); // fell all the way to the watcher
  });
});
