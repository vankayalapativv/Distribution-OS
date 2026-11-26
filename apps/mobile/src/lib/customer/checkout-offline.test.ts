import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { completeOfflineCheckout } from "./checkout-offline";
import type { CheckOutOpts, Fix } from "./checkout-types";

const istDate = vi.fn(() => "2026-11-27");
const kickSync = vi.fn();
const ensureCheckoutQueued = vi.fn();
const localVisitHasOutcome = vi.fn<(...a: unknown[]) => boolean>(() => false);
const captureNoOutcome = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve(null));
const mirrorFollowup = vi.fn();

vi.mock("../db", () => ({ getLocalDb: () => ({}) }));
vi.mock("../day-flag", () => ({ istDate: () => istDate() }));
vi.mock("../sync", () => ({ kickSync: () => kickSync() }));
vi.mock("./visit-queue", () => ({
  ensureCheckoutQueued: (...a: unknown[]) => ensureCheckoutQueued(...a),
  localVisitHasOutcome: (...a: unknown[]) => localVisitHasOutcome(...a),
}));
vi.mock("./checkout-helpers", () => ({
  captureNoOutcome: (...a: unknown[]) => captureNoOutcome(...a),
  mirrorFollowup: (...a: unknown[]) => mirrorFollowup(...a),
}));

const db = {} as never;
const fix: Fix = { latitude: 17.4, longitude: 78.5, accuracy: 8 };
const opts = { visitId: "cu", customerId: "c1", promptReason: vi.fn(), pickDateTime: vi.fn() } as unknown as CheckOutOpts;
beforeEach(() => { localVisitHasOutcome.mockReturnValue(false); });
afterEach(() => vi.clearAllMocks());

describe("completeOfflineCheckout", () => {
  it("queues silently (no reason) when there's already a local outcome today", async () => {
    localVisitHasOutcome.mockReturnValue(true);
    expect(await completeOfflineCheckout(opts, db, "c1", "s1", fix)).toBe(true);
    expect(captureNoOutcome).not.toHaveBeenCalled();
    expect(ensureCheckoutQueued).toHaveBeenCalledWith(db, expect.objectContaining({ clientUuid: "cu", serverId: "s1", noOutcomeReason: undefined, followUpAt: null }), expect.any(Number));
    expect(mirrorFollowup).not.toHaveBeenCalled();
    expect(kickSync).toHaveBeenCalled();
  });

  it("aborts without queueing when the reason prompt is cancelled", async () => {
    captureNoOutcome.mockResolvedValue(null);
    expect(await completeOfflineCheckout(opts, db, "c1", null, fix)).toBe(false);
    expect(ensureCheckoutQueued).not.toHaveBeenCalled();
    expect(kickSync).not.toHaveBeenCalled();
  });

  it("queues with the captured reason + follow-up and mirrors it", async () => {
    captureNoOutcome.mockResolvedValue({ reason: "pay next week", followUpAt: "2026-12-01T09:00:00.000Z" });
    expect(await completeOfflineCheckout(opts, db, "c1", null, fix)).toBe(true);
    expect(ensureCheckoutQueued).toHaveBeenCalledWith(db, expect.objectContaining({ serverId: null, noOutcomeReason: "pay next week", followUpAt: "2026-12-01T09:00:00.000Z" }), expect.any(Number));
    expect(mirrorFollowup).toHaveBeenCalledWith(opts, { reason: "pay next week", followUpAt: "2026-12-01T09:00:00.000Z" });
  });
});
