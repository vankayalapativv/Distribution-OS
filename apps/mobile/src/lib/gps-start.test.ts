import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startDayTracking } from "./gps-start";

const requestForegroundPermissionsAsync = vi.fn<() => Promise<{ granted: boolean }>>(() => Promise.resolve({ granted: true }));
const setItemAsync = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const getItemAsync = vi.fn<(k: string) => Promise<string | null>>(() => Promise.resolve(null));
const bringUpTracking = vi.fn();
const startNativeForegroundTracking = vi.fn<(...a: unknown[]) => Promise<boolean>>(() => Promise.resolve(true));
const clearDayEnded = vi.fn<() => Promise<void>>(() => Promise.resolve());
const createServerSession = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const dayEndedToday = vi.fn<() => Promise<boolean>>(() => Promise.resolve(false));
const ensureClientSessionId = vi.fn<() => Promise<string>>(() => Promise.resolve("cs-new"));
const setClientSessionId = vi.fn();
const sendTrackingHeartbeatNow = vi.fn();
const isDayTracking = vi.fn<() => Promise<boolean>>(() => Promise.resolve(false));
const isPastSeCutoff = vi.fn<() => boolean>(() => false);
let foregroundWatch: { remove: () => void } | null = null;

vi.mock("expo-location", () => ({ requestForegroundPermissionsAsync: () => requestForegroundPermissionsAsync() }));
vi.mock("expo-secure-store", () => ({ setItemAsync: (...a: unknown[]) => setItemAsync(...a), getItemAsync: (k: string) => getItemAsync(k) }));
vi.mock("./day-flag", () => ({ istDate: () => "2026-08-05" }));
vi.mock("./gps-bring-up", () => ({ bringUpTracking: (...a: unknown[]) => bringUpTracking(...a) }));
vi.mock("./gps-keys", () => ({ clientSessionKey: () => "CLI", dayOnKey: () => "ON", dayStartOdoKey: () => "ODO" }));
vi.mock("./gps-native", () => ({ startNativeForegroundTracking: (...a: unknown[]) => startNativeForegroundTracking(...(a as [string])) }));
vi.mock("./gps-session", () => ({
  clearDayEnded: () => clearDayEnded(), createServerSession: (...a: unknown[]) => createServerSession(...(a as [string, number | null])),
  dayEndedToday: () => dayEndedToday(), ensureClientSessionId: () => ensureClientSessionId(),
}));
vi.mock("./gps-state", () => ({ getForegroundWatch: () => foregroundWatch, setClientSessionId: (...a: unknown[]) => setClientSessionId(...a) }));
vi.mock("./gps-status", () => ({ isDayTracking: () => isDayTracking(), isPastSeCutoff: () => isPastSeCutoff() }));
vi.mock("./sync", () => ({ sendTrackingHeartbeatNow: () => sendTrackingHeartbeatNow() }));

beforeEach(() => {
  foregroundWatch = null;
  dayEndedToday.mockResolvedValue(false);
  isDayTracking.mockResolvedValue(false);
  isPastSeCutoff.mockReturnValue(false);
  requestForegroundPermissionsAsync.mockResolvedValue({ granted: true });
  getItemAsync.mockResolvedValue(null);
});
afterEach(() => vi.clearAllMocks());

describe("startDayTracking — guards", () => {
  it("refuses once the day was ended today", async () => {
    dayEndedToday.mockResolvedValue(true);
    expect(await startDayTracking()).toEqual({ ok: false, reason: "day_ended" });
  });
  it("stores the start odometer before branching", async () => {
    isDayTracking.mockResolvedValue(true);
    await startDayTracking({ startOdometer: 48210 });
    expect(setItemAsync).toHaveBeenCalledWith("ODO", "48210");
  });
  it("refuses when foreground permission is denied", async () => {
    requestForegroundPermissionsAsync.mockResolvedValue({ granted: false });
    expect(await startDayTracking()).toEqual({ ok: false, reason: "permission_denied" });
  });
  it("refuses a fresh start past the 8 PM SE cutoff (no server session)", async () => {
    isPastSeCutoff.mockReturnValue(true);
    expect(await startDayTracking({ startOdometer: 100 })).toEqual({ ok: false, reason: "past_cutoff" });
    expect(createServerSession).not.toHaveBeenCalled();
    expect(requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });
  it("still RESUMES an already-running day past the cutoff (re-tap, not a fresh start)", async () => {
    isPastSeCutoff.mockReturnValue(true);
    isDayTracking.mockResolvedValue(true);
    getItemAsync.mockResolvedValue("cs-existing");
    expect(await startDayTracking()).toEqual({ ok: true, mode: "background" });
  });
});

describe("startDayTracking — resume an active day", () => {
  it("refreshes day-on + nudges native + backfills odo, without a clock reset", async () => {
    isDayTracking.mockResolvedValue(true);
    getItemAsync.mockResolvedValue("cs-existing");
    const res = await startDayTracking({ startOdometer: 48210 });
    expect(res).toEqual({ ok: true, mode: "background" });
    expect(setItemAsync).toHaveBeenCalledWith("ON", "2026-08-05");
    expect(startNativeForegroundTracking).toHaveBeenCalledWith("cs-existing");
    expect(createServerSession).toHaveBeenCalledWith("cs-existing", 48210);
    expect(ensureClientSessionId).not.toHaveBeenCalled(); // no fresh session
  });
  it("reports foreground mode when a foreground watch is active", async () => {
    isDayTracking.mockResolvedValue(true);
    getItemAsync.mockResolvedValue("cs-existing");
    foregroundWatch = { remove: () => {} };
    expect((await startDayTracking() as { mode: string }).mode).toBe("foreground");
    expect(createServerSession).not.toHaveBeenCalled(); // no odo
  });
  it("does nothing native when the stored client session is missing/unreadable", async () => {
    isDayTracking.mockResolvedValue(true);
    getItemAsync.mockRejectedValue(new Error("secure read")); // → caught → null
    await startDayTracking();
    expect(startNativeForegroundTracking).not.toHaveBeenCalled();
  });
});

describe("startDayTracking — fresh day", () => {
  it("commits the day, creates the session and brings up tracking detached", async () => {
    const res = await startDayTracking({ startOdometer: 100 });
    expect(res).toEqual({ ok: true, mode: "background" });
    expect(clearDayEnded).toHaveBeenCalled();
    expect(setClientSessionId).toHaveBeenCalledWith("cs-new");
    expect(createServerSession).toHaveBeenCalledWith("cs-new", 100);
    expect(sendTrackingHeartbeatNow).toHaveBeenCalled();
    expect(setItemAsync).toHaveBeenCalledWith("ON", "2026-08-05");
    expect(bringUpTracking).toHaveBeenCalledWith("cs-new");
  });
  it("defaults the server start odometer to null when omitted", async () => {
    await startDayTracking();
    expect(createServerSession).toHaveBeenCalledWith("cs-new", null);
  });
  it("commits the day despite SecureStore + server-session failures", async () => {
    setItemAsync.mockRejectedValue(new Error("secure"));
    createServerSession.mockRejectedValue(new Error("offline"));
    const res = await startDayTracking({ startOdometer: 100 });
    expect(res).toEqual({ ok: true, mode: "background" });
    expect(bringUpTracking).toHaveBeenCalledWith("cs-new");
  });
});

describe("startDayTracking — resume resilience", () => {
  it("resumes despite SecureStore + backfill server-session failures", async () => {
    isDayTracking.mockResolvedValue(true);
    getItemAsync.mockResolvedValue("cs-existing");
    setItemAsync.mockRejectedValue(new Error("secure write"));
    createServerSession.mockRejectedValue(new Error("offline")); // resume backfill catch
    const res = await startDayTracking({ startOdometer: 100 });
    expect(res).toEqual({ ok: true, mode: "background" });
    expect(startNativeForegroundTracking).toHaveBeenCalledWith("cs-existing");
  });
});
