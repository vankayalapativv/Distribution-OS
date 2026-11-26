import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { performCheckOut } from "./checkout";
import { ApiRequestError } from "../api-core";
import type { CheckOutOpts } from "./checkout-types";

const getIsOnline = vi.fn<() => boolean>(() => true);
const getLocalDb = vi.fn<() => unknown>(() => null);
const getCheckInFix = vi.fn();
const completeOfflineCheckout = vi.fn<(...a: unknown[]) => Promise<boolean>>(() => Promise.resolve(true));
const geofenceStop = vi.fn<(...a: unknown[]) => Promise<boolean | null>>(() => Promise.resolve(null));
const postCheckout = vi.fn<(...a: unknown[]) => Promise<boolean>>(() => Promise.resolve(true));

vi.mock("../connectivity", () => ({ getIsOnline: () => getIsOnline() }));
vi.mock("../db", () => ({ getLocalDb: () => getLocalDb() }));
vi.mock("../gps", () => ({ getCheckInFix: (...a: unknown[]) => getCheckInFix(...a) }));
vi.mock("./checkout-offline", () => ({ completeOfflineCheckout: (...a: unknown[]) => completeOfflineCheckout(...a) }));
vi.mock("./checkout-helpers", () => ({ geofenceStop: (...a: unknown[]) => geofenceStop(...a) }));
vi.mock("./checkout-post", () => ({ postCheckout: (...a: unknown[]) => postCheckout(...a) }));

const fix = { latitude: 17.4, longitude: 78.5, accuracy: 8, fresh: true };
const confirm = vi.fn<(...a: unknown[]) => Promise<boolean>>(() => Promise.resolve(true));
function makeOpts(o: Partial<CheckOutOpts> = {}): CheckOutOpts {
  return {
    visitId: "v1", customerId: "c1", token: "tok", customerName: "Balaji",
    saved: { latitude: 17, longitude: 78 }, confirm, promptReason: vi.fn(), pickDateTime: vi.fn(), ...o,
  };
}
const dbWith = (row: unknown) => ({ first: vi.fn(() => row) });

beforeEach(() => {
  getIsOnline.mockReturnValue(true); getLocalDb.mockReturnValue(null);
  getCheckInFix.mockResolvedValue(fix); geofenceStop.mockResolvedValue(null); postCheckout.mockResolvedValue(true);
});
afterEach(() => vi.clearAllMocks());

describe("performCheckOut gps + geofence", () => {
  it("stops without a fix", async () => {
    getCheckInFix.mockResolvedValue(null);
    expect(await performCheckOut(makeOpts())).toBe(false);
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: "Location required" }));
    expect(postCheckout).not.toHaveBeenCalled();
  });
  it("stops on a stale fix", async () => {
    getCheckInFix.mockResolvedValue({ ...fix, fresh: false });
    expect(await performCheckOut(makeOpts())).toBe(false);
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: "Getting your location" }));
  });
  it("retries the whole flow when the geofence prompt says try-again", async () => {
    geofenceStop.mockResolvedValueOnce(true).mockResolvedValue(null);
    expect(await performCheckOut(makeOpts())).toBe(true);
    expect(getCheckInFix).toHaveBeenCalledTimes(2);
  });
  it("gives up when the SE declines the too-far prompt", async () => {
    geofenceStop.mockResolvedValue(false);
    expect(await performCheckOut(makeOpts())).toBe(false);
    expect(postCheckout).not.toHaveBeenCalled();
  });
});

describe("performCheckOut online", () => {
  it("posts with the visit id as server id when there's no local row", async () => {
    expect(await performCheckOut(makeOpts())).toBe(true);
    expect(postCheckout).toHaveBeenCalledWith(expect.anything(), "v1", fix, null);
  });
  it("resolves the server id from the local visits row", async () => {
    getLocalDb.mockReturnValue(dbWith({ server_id: "srv", customer_id: "c2" }));
    await performCheckOut(makeOpts());
    expect(postCheckout).toHaveBeenCalledWith(expect.anything(), "srv", fix, null);
  });
  it("falls through to the offline queue on a status-0 network drop", async () => {
    getLocalDb.mockReturnValue(dbWith({ server_id: "srv", customer_id: "c2" }));
    postCheckout.mockRejectedValue(new ApiRequestError("NETERR", "down", 0));
    expect(await performCheckOut(makeOpts())).toBe(true);
    expect(completeOfflineCheckout).toHaveBeenCalledWith(expect.anything(), expect.anything(), "c2", "srv", fix);
  });
  it("re-throws a real server error (non status-0)", async () => {
    postCheckout.mockRejectedValue(new ApiRequestError("BOOM", "500", 500));
    await expect(performCheckOut(makeOpts())).rejects.toThrow("500");
  });
  it("re-throws a non-API error", async () => {
    postCheckout.mockRejectedValue(new Error("weird"));
    await expect(performCheckOut(makeOpts())).rejects.toThrow("weird");
  });
});

describe("performCheckOut offline", () => {
  it("queues via completeOfflineCheckout when offline with a db", async () => {
    getIsOnline.mockReturnValue(false);
    getLocalDb.mockReturnValue(dbWith(null)); // no local row → customerId from opts
    expect(await performCheckOut(makeOpts())).toBe(true);
    expect(postCheckout).not.toHaveBeenCalled();
    expect(completeOfflineCheckout).toHaveBeenCalledWith(expect.anything(), expect.anything(), "c1", "v1", fix);
  });
  it("skips the online post when the local check-in hasn't synced (no server id)", async () => {
    getLocalDb.mockReturnValue(dbWith({ server_id: null, customer_id: "c2" }));
    expect(await performCheckOut(makeOpts())).toBe(true);
    expect(postCheckout).not.toHaveBeenCalled();
    expect(completeOfflineCheckout).toHaveBeenCalledWith(expect.anything(), expect.anything(), "c2", null, fix);
  });
  it("reports unavailable when offline with no local db", async () => {
    getIsOnline.mockReturnValue(false);
    getLocalDb.mockReturnValue(null);
    expect(await performCheckOut(makeOpts())).toBe(false);
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: "Check-out unavailable" }));
  });
});
