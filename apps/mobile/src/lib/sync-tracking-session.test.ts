import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureServerTrackingSession, sendGpsBatch } from "./sync-tracking-session";
import type { GpsPingInput } from "./sync-core";

const apiFetch = vi.fn();
const getItemAsync = vi.fn<(k: string) => Promise<string | null>>();
const setItemAsync = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
let token: string | null = "tok";
vi.mock("expo-secure-store", () => ({
  getItemAsync: (k: string) => getItemAsync(k),
  setItemAsync: (...a: unknown[]) => setItemAsync(...a),
}));
vi.mock("./api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("./auth", () => ({ useAuth: { getState: () => ({ token }) } }));
vi.mock("./gps-keys", () => ({
  serverSessionKey: () => "SRV",
  clientSessionKey: () => "CLI",
  stopHourKey: () => "STOP",
}));

const pt = (over: Partial<GpsPingInput> = {}): GpsPingInput => ({ latitude: 1, longitude: 2, accuracy: 5, batteryPercentage: 90, recordedAt: "t", ...over }) as GpsPingInput;

beforeEach(() => { token = "tok"; getItemAsync.mockResolvedValue(null); });
afterEach(() => vi.clearAllMocks());

describe("ensureServerTrackingSession", () => {
  it("returns null without a token", async () => {
    token = null;
    expect(await ensureServerTrackingSession([])).toBeNull();
  });
  it("returns an already-started session", async () => {
    getItemAsync.mockImplementation((k) => Promise.resolve(k === "SRV" ? "srv-1" : null));
    expect(await ensureServerTrackingSession([])).toBe("srv-1");
    expect(apiFetch).not.toHaveBeenCalled();
  });
  it("starts a session from a point's client session id and caches the stop hour", async () => {
    apiFetch.mockResolvedValue({ trackingSessionId: "srv-9", seTrackingStopHour: 20 });
    const out = await ensureServerTrackingSession([pt({ clientSessionId: "cs-1" })]);
    expect(out).toBe("srv-9");
    expect(apiFetch).toHaveBeenCalledWith("/tracking-sessions/start", expect.objectContaining({ method: "POST", body: { clientSessionId: "cs-1", deviceId: null } }));
    expect(setItemAsync).toHaveBeenCalledWith("SRV", "srv-9");
    expect(setItemAsync).toHaveBeenCalledWith("STOP", "20");
  });
  it("falls back to the stored client session id and skips a non-numeric stop hour", async () => {
    getItemAsync.mockImplementation((k) => Promise.resolve(k === "CLI" ? "cs-stored" : null));
    apiFetch.mockResolvedValue({ trackingSessionId: "srv-9", seTrackingStopHour: null });
    await ensureServerTrackingSession([]);
    expect(apiFetch).toHaveBeenCalledWith("/tracking-sessions/start", expect.objectContaining({ body: { clientSessionId: "cs-stored", deviceId: null } }));
    expect(setItemAsync).not.toHaveBeenCalledWith("STOP", expect.anything());
  });
  it("returns null when no client session id is known", async () => {
    expect(await ensureServerTrackingSession([])).toBeNull();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("returns null when the stored client-session read fails", async () => {
    getItemAsync.mockRejectedValue(new Error("secure read"));
    expect(await ensureServerTrackingSession([])).toBeNull(); // both getItem catches → null
  });

  it("tolerates SecureStore read/write failures", async () => {
    getItemAsync.mockRejectedValue(new Error("secure read"));
    setItemAsync.mockRejectedValue(new Error("secure write"));
    apiFetch.mockResolvedValue({ trackingSessionId: "srv-9", seTrackingStopHour: 20 });
    const out = await ensureServerTrackingSession([pt({ clientSessionId: "cs-1" })]);
    expect(out).toBe("srv-9"); // completed despite the SecureStore failures
  });
});

describe("sendGpsBatch", () => {
  it("posts to the session endpoint when a session exists", async () => {
    getItemAsync.mockImplementation((k) => Promise.resolve(k === "SRV" ? "srv-1" : null));
    apiFetch.mockResolvedValue({ ok: true });
    await sendGpsBatch([pt()]);
    expect(apiFetch).toHaveBeenCalledWith("/tracking-sessions/srv-1/points/batch", expect.objectContaining({ method: "POST" }));
  });
  it("falls back to the legacy batch endpoint without a session", async () => {
    apiFetch.mockResolvedValue({ ok: true });
    await sendGpsBatch([pt()]); // no client session id → ensure returns null
    expect(apiFetch).toHaveBeenCalledWith("/visits/gps/batch", expect.objectContaining({ method: "POST" }));
  });
});
