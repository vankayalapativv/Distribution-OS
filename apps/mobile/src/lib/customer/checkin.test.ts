import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkinClientUuid, performCheckIn } from "./checkin";
import type { CheckInOpts } from "./checkin-types";

const digestStringAsync = vi.fn<(...a: unknown[]) => Promise<string>>(() => Promise.resolve("0123456789abcdef".repeat(4)));
const apiFetch = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve({ visitId: "v1" }));
const getLocalDb = vi.fn<() => unknown>(() => ({}));
const recordVisitCheckin = vi.fn();
const preflightCheckIn = vi.fn();
const handleCheckInOutcome = vi.fn<(...a: unknown[]) => Promise<string | null>>(() => Promise.resolve("v1"));
let lastCfg: { send: () => Promise<unknown>; queue: () => void };
const submitWrite = vi.fn(async (cfg: typeof lastCfg) => { lastCfg = cfg; return { status: "sent", data: { visitId: "v1" } }; });

vi.mock("expo-crypto", () => ({
  digestStringAsync: (...a: unknown[]) => digestStringAsync(...a),
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
}));
vi.mock("../api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("../db", () => ({ getLocalDb: () => getLocalDb() }));
vi.mock("../online-first", () => ({ submitWrite: (cfg: typeof lastCfg) => submitWrite(cfg) }));
vi.mock("./checkin-outcome", () => ({ handleCheckInOutcome: (...a: unknown[]) => handleCheckInOutcome(...a) }));
vi.mock("./checkin-preflight", () => ({ preflightCheckIn: (...a: unknown[]) => preflightCheckIn(...a) }));
vi.mock("./visit-queue", () => ({ recordVisitCheckin: (...a: unknown[]) => recordVisitCheckin(...a) }));

const fix = { latitude: 17.4, longitude: 78.5, fresh: true };
function makeOpts(o: Partial<CheckInOpts> = {}): CheckInOpts {
  return {
    id: "c1", token: "tok", userId: "u1", customerName: "Balaji",
    saved: { latitude: 17, longitude: 78 }, role: "SALES_EXECUTIVE",
    confirm: vi.fn<(...a: unknown[]) => Promise<boolean>>(() => Promise.resolve(true)), ...o,
  };
}

beforeEach(() => { preflightCheckIn.mockResolvedValue({ status: "ok", fix }); getLocalDb.mockReturnValue({}); });
afterEach(() => vi.clearAllMocks());

describe("checkinClientUuid", () => {
  it("formats the SHA-256 digest as a UUID seeded by user/customer/day", async () => {
    const uuid = await checkinClientUuid("u1", "c1", "2026-11-27");
    expect(digestStringAsync).toHaveBeenCalledWith("SHA-256", "u1:c1:2026-11-27");
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
  it("seeds with 'anon' when there is no user id", async () => {
    await checkinClientUuid(undefined, "c1", "2026-11-27");
    expect(digestStringAsync).toHaveBeenCalledWith("SHA-256", "anon:c1:2026-11-27");
  });
});

describe("performCheckIn", () => {
  it("returns null and skips the write when preflight says stop", async () => {
    preflightCheckIn.mockResolvedValue({ status: "stop" });
    expect(await performCheckIn(makeOpts())).toBeNull();
    expect(submitWrite).not.toHaveBeenCalled();
  });

  it("retries the whole flow when preflight asks to retry", async () => {
    preflightCheckIn.mockResolvedValueOnce({ status: "retry" }).mockResolvedValueOnce({ status: "ok", fix });
    await performCheckIn(makeOpts());
    expect(preflightCheckIn).toHaveBeenCalledTimes(2);
    expect(submitWrite).toHaveBeenCalledTimes(1);
  });

  it("marks Super Admins as admin for the preflight gate", async () => {
    await performCheckIn(makeOpts({ role: "SUPER_ADMIN" }));
    expect(preflightCheckIn).toHaveBeenCalledWith(expect.anything(), true);
  });

  it("submits online-first and returns the outcome handle", async () => {
    handleCheckInOutcome.mockResolvedValue("v1");
    expect(await performCheckIn(makeOpts())).toBe("v1");
    // the send() closure hits the check-in endpoint with the built payload
    await lastCfg.send();
    expect(apiFetch).toHaveBeenCalledWith("/visits/checkin", expect.objectContaining({
      method: "POST",
      body: expect.objectContaining({ customerId: "c1", latitude: 17.4, longitude: 78.5 }),
    }));
  });

  it("queue closure records the visit to the local outbox when offline", async () => {
    await performCheckIn(makeOpts());
    lastCfg.queue();
    expect(recordVisitCheckin).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ customerId: "c1", latitude: 17.4, longitude: 78.5 }),
      expect.any(Number),
    );
  });

  it("queue closure throws (→ unsaved) when there is no local db", async () => {
    await performCheckIn(makeOpts());
    getLocalDb.mockReturnValue(null);
    expect(() => lastCfg.queue()).toThrow(/no local db/);
  });
});
