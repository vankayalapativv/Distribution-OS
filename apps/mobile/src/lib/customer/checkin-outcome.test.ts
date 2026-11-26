import { afterEach, describe, expect, it, vi } from "vitest";
import { handleCheckInOutcome } from "./checkin-outcome";
import { ApiRequestError } from "../api-core";
import type { CheckInOpts } from "./checkin-types";
import type { WriteOutcome } from "../online-first";

const push = vi.fn();
const getLocalDb = vi.fn(() => ({}) as unknown);
const kickSync = vi.fn();
const showFollowupIfAny = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());

vi.mock("expo-router", () => ({ router: { push: (...a: unknown[]) => push(...a) } }));
vi.mock("../db", () => ({ getLocalDb: () => getLocalDb() }));
vi.mock("../sync", () => ({ kickSync: () => kickSync() }));
vi.mock("./checkin-followup", () => ({ showFollowupIfAny: (...a: unknown[]) => showFollowupIfAny(...a) }));

const confirm = vi.fn<(...a: unknown[]) => Promise<boolean>>(() => Promise.resolve(true));
const opts: CheckInOpts = {
  id: "c1", token: "tok", userId: "u1", customerName: "Balaji",
  saved: { latitude: null, longitude: null }, role: "SALES_EXECUTIVE", confirm,
};
type O = WriteOutcome<{ visitId: string }>;
afterEach(() => vi.clearAllMocks());

describe("handleCheckInOutcome success", () => {
  it("returns the server visit id and shows any pending follow-up", async () => {
    const r = await handleCheckInOutcome({ status: "sent", data: { visitId: "v9" } } as O, opts, "cu");
    expect(r).toBe("v9");
    expect(showFollowupIfAny).toHaveBeenCalled();
  });
  it("falls back to the clientUuid when the server returns no visit id", async () => {
    const r = await handleCheckInOutcome({ status: "sent", data: {} } as unknown as O, opts, "cu");
    expect(r).toBe("cu");
  });
  it("queues offline: kicks a sync and returns the local handle", async () => {
    const r = await handleCheckInOutcome({ status: "queued" } as O, opts, "cu");
    expect(kickSync).toHaveBeenCalled();
    expect(r).toBe("cu");
  });
});

describe("handleCheckInOutcome OPEN_VISIT", () => {
  it("offers to jump to the open visit and navigates on confirm", async () => {
    confirm.mockResolvedValueOnce(true);
    const err = new ApiRequestError("OPEN_VISIT", "Finish your visit at Shop A first.", 409, { customerId: "c2", customerName: "Shop A" });
    const r = await handleCheckInOutcome({ status: "rejected", error: err } as O, opts, "cu");
    expect(push).toHaveBeenCalledWith({ pathname: "/customer/[id]", params: { id: "c2", name: "Shop A" } });
    expect(r).toBeNull();
  });
  it("navigates with a blank name when the open visit has no customerName", async () => {
    confirm.mockResolvedValueOnce(true);
    const err = new ApiRequestError("OPEN_VISIT", "msg", 409, { customerId: "c2" });
    const r = await handleCheckInOutcome({ status: "rejected", error: err } as O, opts, "cu");
    expect(push).toHaveBeenCalledWith({ pathname: "/customer/[id]", params: { id: "c2", name: "" } });
    expect(r).toBeNull();
  });
  it("handles the offer being declined (no navigation)", async () => {
    confirm.mockResolvedValueOnce(false);
    const err = new ApiRequestError("OPEN_VISIT", "msg", 409, { customerId: "c2", customerName: "Shop A" });
    const r = await handleCheckInOutcome({ status: "rejected", error: err } as O, opts, "cu");
    expect(push).not.toHaveBeenCalled();
    expect(r).toBeNull();
  });
  it("falls through to a generic dialog when OPEN_VISIT has no target customer", async () => {
    const err = new ApiRequestError("OPEN_VISIT", "already in", 409, {});
    await handleCheckInOutcome({ status: "rejected", error: err } as O, opts, "cu");
    expect(push).not.toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: "Check-in failed", message: "already in" }));
  });
});

describe("handleCheckInOutcome other failures", () => {
  it("surfaces the server message for a non-OPEN_VISIT rejection", async () => {
    const err = new ApiRequestError("ALREADY_VISITED", "You've already completed a visit here today.", 409);
    await handleCheckInOutcome({ status: "rejected", error: err } as O, opts, "cu");
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ message: "You've already completed a visit here today." }));
  });
  it("uses the default message when the error isn't an ApiRequestError", async () => {
    await handleCheckInOutcome({ status: "rejected", error: new Error("boom") } as O, opts, "cu");
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/Pull to refresh/) }));
  });
  it("explains an unsaved (no local DB) outcome", async () => {
    await handleCheckInOutcome({ status: "unsaved" } as O, opts, "cu");
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/Couldn't save the check-in on this device/) }));
  });
});
