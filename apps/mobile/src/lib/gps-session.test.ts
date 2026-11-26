import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearDayEnded,
  createServerSession,
  dayEndedToday,
  dayStartedToday,
  ensureClientSessionId,
  getDayStartOdometer,
  getServerStartOdometer,
  markDayEndedToday,
} from "./gps-session";

const apiFetch = vi.fn();
const getItemAsync = vi.fn<(k: string) => Promise<string | null>>(() => Promise.resolve(null));
const setItemAsync = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const deleteItemAsync = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const setClientSessionId = vi.fn();
const dayFlagIsForToday = vi.fn<(f: unknown) => boolean>();
let token: string | null = "tok";

vi.mock("expo-crypto", () => ({ randomUUID: () => "uuid-new" }));
vi.mock("expo-secure-store", () => ({
  getItemAsync: (k: string) => getItemAsync(k),
  setItemAsync: (...a: unknown[]) => setItemAsync(...a),
  deleteItemAsync: (...a: unknown[]) => deleteItemAsync(...a),
}));
vi.mock("./api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("./auth", () => ({ useAuth: { getState: () => ({ token }) } }));
vi.mock("./day-flag", () => ({ dayFlagIsForToday: (f: unknown) => dayFlagIsForToday(f), istDate: () => "2026-08-05" }));
vi.mock("./gps-keys", () => ({
  clientSessionKey: () => "CLI", dayEndedKey: () => "ENDED", dayOnKey: () => "ON",
  dayStartOdoKey: () => "ODO", serverSessionKey: () => "SRV",
}));
vi.mock("./gps-state", () => ({ setClientSessionId: (...a: unknown[]) => setClientSessionId(...a) }));

beforeEach(() => { token = "tok"; getItemAsync.mockResolvedValue(null); dayFlagIsForToday.mockReturnValue(false); });
afterEach(() => vi.clearAllMocks());

describe("ensureClientSessionId", () => {
  it("reuses a stored id", async () => {
    getItemAsync.mockResolvedValue("cs-existing");
    expect(await ensureClientSessionId()).toBe("cs-existing");
    expect(setClientSessionId).toHaveBeenCalledWith("cs-existing");
    expect(setItemAsync).not.toHaveBeenCalled();
  });
  it("mints + persists a new id when none is stored (tolerating store failures)", async () => {
    getItemAsync.mockRejectedValue(new Error("x")); // read catch → null → mint
    setItemAsync.mockRejectedValue(new Error("x")); // write catch swallowed
    expect(await ensureClientSessionId()).toBe("uuid-new");
    expect(setItemAsync).toHaveBeenCalledWith("CLI", "uuid-new");
    expect(setClientSessionId).toHaveBeenCalledWith("uuid-new");
  });
});

describe("createServerSession", () => {
  it("does nothing without a token", async () => {
    token = null;
    await createServerSession("cs-1");
    expect(apiFetch).not.toHaveBeenCalled();
  });
  it("starts a server session and stores its id", async () => {
    apiFetch.mockResolvedValue({ trackingSessionId: "srv-1" });
    await createServerSession("cs-1", 48210);
    expect(apiFetch).toHaveBeenCalledWith("/tracking-sessions/start", expect.objectContaining({ body: { clientSessionId: "cs-1", deviceId: null, startOdometer: 48210 } }));
    expect(setItemAsync).toHaveBeenCalledWith("SRV", "srv-1");
  });
  it("defaults the start odometer to null when omitted, tolerating a store failure", async () => {
    apiFetch.mockResolvedValue({ trackingSessionId: "srv-2" });
    setItemAsync.mockRejectedValue(new Error("x"));
    await createServerSession("cs-1");
    expect(apiFetch).toHaveBeenCalledWith("/tracking-sessions/start", expect.objectContaining({ body: { clientSessionId: "cs-1", deviceId: null, startOdometer: null } }));
  });
});

describe("getServerStartOdometer", () => {
  it("returns null without a token", async () => {
    token = null;
    expect(await getServerStartOdometer()).toBeNull();
  });
  it("returns the active session's odometer, else null", async () => {
    apiFetch.mockResolvedValue({ activeSession: { startOdometer: 48210 } });
    expect(await getServerStartOdometer()).toBe(48210);
    apiFetch.mockResolvedValue({ activeSession: null });
    expect(await getServerStartOdometer()).toBeNull();
    apiFetch.mockRejectedValue(new Error("offline"));
    expect(await getServerStartOdometer()).toBeNull();
  });
});

describe("getDayStartOdometer", () => {
  it("parses a stored reading, else null", async () => {
    getItemAsync.mockResolvedValue("48210");
    expect(await getDayStartOdometer()).toBe(48210);
    getItemAsync.mockResolvedValue(null);
    expect(await getDayStartOdometer()).toBeNull();
    getItemAsync.mockResolvedValue("not-a-number");
    expect(await getDayStartOdometer()).toBeNull();
  });
});

describe("dayStartedToday / dayEndedToday", () => {
  it("is true for today's flag", async () => {
    dayFlagIsForToday.mockReturnValue(true);
    getItemAsync.mockResolvedValue("2026-08-05");
    expect(await dayStartedToday()).toBe(true);
    expect(await dayEndedToday()).toBe(true);
  });
  it("clears a stale flag and reads false (tolerating a delete failure)", async () => {
    getItemAsync.mockResolvedValue("2026-08-04"); // stale
    deleteItemAsync.mockRejectedValue(new Error("x")); // catch is swallowed
    expect(await dayStartedToday()).toBe(false);
    expect(deleteItemAsync).toHaveBeenCalledWith("ON");
    expect(await dayEndedToday()).toBe(false);
    expect(deleteItemAsync).toHaveBeenCalledWith("ENDED");
  });
  it("reads false with no flag and clears nothing", async () => {
    getItemAsync.mockResolvedValue(null);
    expect(await dayStartedToday()).toBe(false);
    expect(deleteItemAsync).not.toHaveBeenCalled();
  });
  it("reads false/null when the flag read itself fails", async () => {
    getItemAsync.mockRejectedValue(new Error("x")); // read catches → null flag
    expect(await dayStartedToday()).toBe(false);
    expect(await dayEndedToday()).toBe(false);
    expect(await getDayStartOdometer()).toBeNull();
  });
});

describe("markDayEndedToday / clearDayEnded", () => {
  it("stamps + clears the day-ended flag (tolerating store failures)", async () => {
    setItemAsync.mockRejectedValue(new Error("x"));
    deleteItemAsync.mockRejectedValue(new Error("x"));
    await markDayEndedToday();
    expect(setItemAsync).toHaveBeenCalledWith("ENDED", "2026-08-05");
    await clearDayEnded();
    expect(deleteItemAsync).toHaveBeenCalledWith("ENDED");
  });
});
