import { afterEach, describe, expect, it, vi } from "vitest";
import { captureNoOutcome, geofenceStop, mirrorFollowup } from "./checkout-helpers";
import type { CheckOutOpts, Fix } from "./checkout-types";

const getLocalDb = vi.fn<() => unknown>(() => ({}));
const checkInFence = vi.fn();
const recordFollowup = vi.fn();
vi.mock("../db", () => ({ getLocalDb: () => getLocalDb() }));
vi.mock("../geo", () => ({ checkInFence: (...a: unknown[]) => checkInFence(...a) }));
vi.mock("./followups", () => ({ recordFollowup: (...a: unknown[]) => recordFollowup(...a) }));

const fix: Fix = { latitude: 17.4, longitude: 78.5, accuracy: 8 };
const opts = { customerId: "c1", customerName: "Balaji" } as CheckOutOpts;
afterEach(() => vi.clearAllMocks());

describe("captureNoOutcome", () => {
  it("returns null when the SE cancels the reason", async () => {
    const promptReason = vi.fn<() => Promise<string | null>>(() => Promise.resolve(null));
    const pickDateTime = vi.fn();
    expect(await captureNoOutcome(promptReason, pickDateTime as never)).toBeNull();
    expect(pickDateTime).not.toHaveBeenCalled();
  });
  it("captures reason + a chosen follow-up time", async () => {
    const promptReason = vi.fn<() => Promise<string | null>>(() => Promise.resolve("pay next week"));
    const pickDateTime = vi.fn<() => Promise<string | null>>(() => Promise.resolve("2026-12-01T09:00:00.000Z"));
    expect(await captureNoOutcome(promptReason, pickDateTime)).toEqual({ reason: "pay next week", followUpAt: "2026-12-01T09:00:00.000Z" });
  });
  it("captures reason with a skipped reminder", async () => {
    const promptReason = vi.fn<() => Promise<string | null>>(() => Promise.resolve("no stock"));
    const pickDateTime = vi.fn<() => Promise<string | null>>(() => Promise.resolve(null));
    expect(await captureNoOutcome(promptReason, pickDateTime)).toEqual({ reason: "no stock", followUpAt: null });
  });
});

describe("mirrorFollowup", () => {
  it("writes to the local store when a db is present", () => {
    const db = { tag: "db" };
    getLocalDb.mockReturnValue(db);
    mirrorFollowup(opts, { reason: "r", followUpAt: null });
    expect(recordFollowup).toHaveBeenCalledWith(db, expect.objectContaining({ customerId: "c1", customerName: "Balaji", reason: "r" }), expect.any(Number));
  });
  it("no-ops without a local db", () => {
    getLocalDb.mockReturnValue(null);
    mirrorFollowup(opts, { reason: "r", followUpAt: null });
    expect(recordFollowup).not.toHaveBeenCalled();
  });
});

describe("geofenceStop", () => {
  const confirm = vi.fn<(...a: unknown[]) => Promise<boolean>>(() => Promise.resolve(true));
  it("passes (null) when the customer has no saved location", async () => {
    expect(await geofenceStop(fix, { latitude: null, longitude: null }, "Balaji", confirm)).toBeNull();
    expect(checkInFence).not.toHaveBeenCalled();
  });
  it("passes (null) when inside the fence", async () => {
    checkInFence.mockReturnValue({ allowed: true, distanceM: 10 });
    expect(await geofenceStop(fix, { latitude: 17, longitude: 78 }, "Balaji", confirm)).toBeNull();
  });
  it("prompts with a kilometre distance when far and returns the SE's choice", async () => {
    checkInFence.mockReturnValue({ allowed: false, distanceM: 1500 });
    confirm.mockResolvedValueOnce(true);
    expect(await geofenceStop(fix, { latitude: 17, longitude: 78 }, "Balaji", confirm)).toBe(true);
    expect((confirm.mock.calls[0][0] as { message: string }).message).toContain("1.5 km");
  });
  it("prompts with a metre distance when moderately far", async () => {
    checkInFence.mockReturnValue({ allowed: false, distanceM: 250 });
    confirm.mockResolvedValueOnce(false);
    expect(await geofenceStop(fix, { latitude: 17, longitude: 78 }, "Balaji", confirm)).toBe(false);
    expect((confirm.mock.calls[0][0] as { message: string }).message).toContain("250 m");
  });
});
