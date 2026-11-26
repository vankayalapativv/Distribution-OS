import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCollectionSubmit, type CollectionWriteArgs, type CollectionWriteCallbacks } from "./collection-write";
import type { PickedPhoto } from "../photos";

const submitWrite = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve({ status: "sent", data: "COL-1" }));
const getLocalDb = vi.fn<() => unknown>(() => ({}));
const kickSync = vi.fn();
const recordCollection = vi.fn();
const submitCollection = vi.fn<(...a: unknown[]) => Promise<string>>(() => Promise.resolve("COL-1"));
vi.mock("../db", () => ({ getLocalDb: () => getLocalDb() }));
vi.mock("../online-first", () => ({ submitWrite: (c: unknown) => submitWrite(c) }));
vi.mock("../sync", () => ({ kickSync: () => kickSync() }));
vi.mock("./collection-queue", () => ({ recordCollection: (...a: unknown[]) => recordCollection(...a) }));
vi.mock("./submit", () => ({ submitCollection: (...a: unknown[]) => submitCollection(...a) }));

const photo = { uri: "file://p.jpg", name: "p", type: "image/jpeg" } as PickedPhoto;
const args: CollectionWriteArgs = {
  token: "tok", customerId: "c1", collectionType: "general", amountNum: 500, mode: "cash",
  reference: "", bankName: "", photo, clientUuid: "uuid-1", collectionDate: "2026-11-27",
  paymentReferenceNumber: null, bank: null,
};
function makeCb(over: Partial<CollectionWriteCallbacks> = {}): CollectionWriteCallbacks {
  return {
    mounted: { current: true }, setStatus: vi.fn(), setConfirmedCode: vi.fn(),
    setQueued: vi.fn(), setSubmitError: vi.fn(), setSubmitting: vi.fn(), ...over,
  };
}
const lastCfg = () => submitWrite.mock.calls.at(-1)![0] as { send: () => Promise<unknown>; queue: () => void };
beforeEach(() => { submitWrite.mockResolvedValue({ status: "sent", data: "COL-1" }); getLocalDb.mockReturnValue({}); });
afterEach(() => vi.clearAllMocks());

describe("runCollectionSubmit outcomes", () => {
  it("confirms the code on a sent outcome", async () => {
    const cb = makeCb();
    await runCollectionSubmit(args, cb);
    expect(cb.setConfirmedCode).toHaveBeenCalledWith("COL-1");
  });
  it("queues + kicks a sync on a queued outcome", async () => {
    submitWrite.mockResolvedValue({ status: "queued" });
    const cb = makeCb();
    await runCollectionSubmit(args, cb);
    expect(kickSync).toHaveBeenCalled();
    expect(cb.setQueued).toHaveBeenCalledWith(true);
  });
  it("shows a device error on an unsaved outcome", async () => {
    submitWrite.mockResolvedValue({ status: "unsaved" });
    const cb = makeCb();
    await runCollectionSubmit(args, cb);
    expect(cb.setSubmitError).toHaveBeenCalledWith(expect.stringMatching(/on this device/));
    expect(cb.setSubmitting).toHaveBeenCalledWith(false);
  });
  it("shows a server-rejected error otherwise", async () => {
    submitWrite.mockResolvedValue({ status: "rejected" });
    const cb = makeCb();
    await runCollectionSubmit(args, cb);
    expect(cb.setSubmitError).toHaveBeenCalledWith(expect.stringMatching(/server rejected/));
  });
  it("skips all setState when unmounted", async () => {
    const cb = makeCb({ mounted: { current: false } });
    await runCollectionSubmit(args, cb);
    expect(cb.setConfirmedCode).not.toHaveBeenCalled();
  });
});

describe("runCollectionSubmit failure", () => {
  it("surfaces the error message (Error + non-Error) and stops submitting", async () => {
    submitWrite.mockRejectedValueOnce(new Error("timeout"));
    const cb = makeCb();
    await runCollectionSubmit(args, cb);
    expect(cb.setSubmitError).toHaveBeenCalledWith("timeout");
    expect(cb.setSubmitting).toHaveBeenCalledWith(false);
    submitWrite.mockRejectedValueOnce("boom");
    const cb2 = makeCb();
    await runCollectionSubmit(args, cb2);
    expect(cb2.setSubmitError).toHaveBeenCalledWith(expect.stringMatching(/Could not record/));
  });
  it("stays silent on failure when unmounted", async () => {
    submitWrite.mockRejectedValueOnce(new Error("x"));
    const cb = makeCb({ mounted: { current: false } });
    await runCollectionSubmit(args, cb);
    expect(cb.setSubmitError).not.toHaveBeenCalled();
  });
});

describe("runCollectionSubmit send/queue closures", () => {
  it("send delegates to submitCollection with the form values", async () => {
    const cb = makeCb();
    await runCollectionSubmit(args, cb);
    await lastCfg().send();
    expect(submitCollection).toHaveBeenCalledWith(expect.objectContaining({ customerId: "c1", clientUuid: "uuid-1", onStatus: cb.setStatus }));
  });
  it("queue records to the local outbox, or throws without a db", async () => {
    const cb = makeCb();
    await runCollectionSubmit(args, cb);
    lastCfg().queue();
    expect(recordCollection).toHaveBeenCalledWith({}, expect.objectContaining({ clientUuid: "uuid-1", collectionAmount: 500 }), expect.any(Number));
    getLocalDb.mockReturnValue(null);
    expect(() => lastCfg().queue()).toThrow(/no local db/);
  });
});
