import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stopDayTracking } from "./gps-stop";

const apiFetch = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve({}));
const getItemAsync = vi.fn<(k: string) => Promise<string | null>>(() => Promise.resolve(null));
const deleteItemAsync = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const hasStartedLocationUpdatesAsync = vi.fn<() => Promise<boolean>>(() => Promise.resolve(false));
const stopLocationUpdatesAsync = vi.fn<() => Promise<void>>(() => Promise.resolve());
const stopNativeForegroundTracking = vi.fn<() => Promise<void>>(() => Promise.resolve());
const kickSync = vi.fn();
const removeWatch = vi.fn();
const setClientSessionId = vi.fn();
const setForegroundWatch = vi.fn();
let foregroundWatch: { remove: () => void } | null = null;
let token: string | null = "tok";

vi.mock("expo-location", () => ({
  hasStartedLocationUpdatesAsync: () => hasStartedLocationUpdatesAsync(),
  stopLocationUpdatesAsync: () => stopLocationUpdatesAsync(),
}));
vi.mock("expo-secure-store", () => ({
  getItemAsync: (k: string) => getItemAsync(k),
  deleteItemAsync: (...a: unknown[]) => deleteItemAsync(...a),
}));
vi.mock("./api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("./auth", () => ({ useAuth: { getState: () => ({ token }) } }));
vi.mock("./gps-config", () => ({
  GPS_TASK: "task", NATIVE_TEARDOWN_TIMEOUT_MS: 4000, LEGACY_UNSCOPED_KEYS: ["L1", "L2"],
  withTimeout: (p: Promise<unknown>, _ms: number, fb: unknown) => Promise.resolve(p).catch(() => fb),
}));
vi.mock("./gps-keys", () => ({ clientSessionKey: () => "CLI", dayOnKey: () => "ON", dayStartOdoKey: () => "ODO", serverSessionKey: () => "SRV" }));
vi.mock("./gps-native", () => ({ stopNativeForegroundTracking: () => stopNativeForegroundTracking() }));
vi.mock("./gps-state", () => ({
  getForegroundWatch: () => foregroundWatch,
  setClientSessionId: (...a: unknown[]) => setClientSessionId(...a),
  setForegroundWatch: (...a: unknown[]) => setForegroundWatch(...a),
}));
vi.mock("./sync", () => ({ kickSync: () => kickSync() }));

beforeEach(() => {
  token = "tok";
  foregroundWatch = { remove: removeWatch };
  getItemAsync.mockImplementation((k) => Promise.resolve(k === "SRV" ? "srv-1" : null));
  hasStartedLocationUpdatesAsync.mockResolvedValue(false);
});
afterEach(() => vi.clearAllMocks());

describe("stopDayTracking", () => {
  it("tears down local state, native tracking and closes the server session (manual end + odo)", async () => {
    hasStartedLocationUpdatesAsync.mockResolvedValue(true);
    await stopDayTracking({ endOdometer: 48310 });
    expect(deleteItemAsync).toHaveBeenCalledWith("ON");
    expect(deleteItemAsync).toHaveBeenCalledWith("L1");
    expect(setClientSessionId).toHaveBeenCalledWith(null);
    expect(removeWatch).toHaveBeenCalled();
    expect(setForegroundWatch).toHaveBeenCalledWith(null);
    expect(stopNativeForegroundTracking).toHaveBeenCalled();
    expect(stopLocationUpdatesAsync).toHaveBeenCalled();
    expect(kickSync).toHaveBeenCalled();
    expect(apiFetch).toHaveBeenCalledWith("/tracking-sessions/srv-1/end", expect.objectContaining({ body: { endedReason: "manual", endOdometer: 48310 } }));
  });

  it("omits the odometer when not provided", async () => {
    await stopDayTracking();
    expect(apiFetch).toHaveBeenCalledWith("/tracking-sessions/srv-1/end", expect.objectContaining({ body: { endedReason: "manual" } }));
  });

  it("does not close the server session on logout", async () => {
    await stopDayTracking({ endServerSession: false });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("skips stopLocationUpdates when the task is not running", async () => {
    hasStartedLocationUpdatesAsync.mockResolvedValue(false);
    await stopDayTracking();
    expect(stopLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it("falls back to the legacy end endpoint when there is no server session", async () => {
    getItemAsync.mockResolvedValue(null); // no server session id
    await stopDayTracking();
    expect(apiFetch).toHaveBeenCalledWith("/visits/gps/end", expect.objectContaining({ method: "POST" }));
  });

  it("does not call the server end at all when signed out", async () => {
    token = null;
    getItemAsync.mockResolvedValue(null);
    await stopDayTracking();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("tolerates no active foreground watch", async () => {
    foregroundWatch = null;
    await expect(stopDayTracking()).resolves.toBeUndefined();
    expect(removeWatch).not.toHaveBeenCalled();
  });

  it("reads the task as not-running when the status check errors", async () => {
    hasStartedLocationUpdatesAsync.mockRejectedValue(new Error("x")); // → caught → false
    await stopDayTracking();
    expect(stopLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it("swallows every teardown failure (deletes, native stop, stop-updates, server end)", async () => {
    hasStartedLocationUpdatesAsync.mockResolvedValue(true);
    stopLocationUpdatesAsync.mockRejectedValue(new Error("x"));
    stopNativeForegroundTracking.mockRejectedValue(new Error("x"));
    deleteItemAsync.mockRejectedValue(new Error("x"));
    apiFetch.mockRejectedValue(new Error("x"));
    await expect(stopDayTracking({ endOdometer: 1 })).resolves.toBeUndefined();
    expect(stopLocationUpdatesAsync).toHaveBeenCalled();
    expect(apiFetch).toHaveBeenCalled();
  });

  it("treats a failed server-session read as no session (legacy end path)", async () => {
    getItemAsync.mockRejectedValue(new Error("x")); // serverSession read → caught → null
    await stopDayTracking();
    expect(apiFetch).toHaveBeenCalledWith("/visits/gps/end", expect.objectContaining({ method: "POST" }));
  });
});
