import { describe, expect, it, vi } from "vitest";
import { performSaveDeliveryStop, type StopInput, type StopIo } from "./deliver-stop-actions";
import type { LocalDb } from "./local-db";

const DB = {} as LocalDb;
const INPUT: StopInput = {
  clientUuid: "u1",
  runClientUuid: "run-u1",
  runServerId: "srv-run-1",
  customerId: "c1",
  customerName: "Raj Motors",
  invoiceId: "inv-1",
  invoiceNumber: "INV-1",
  photoPaths: ["a.jpg", "b.jpg"],
  latitude: 13,
  longitude: 80,
};

/** A permanent (non-retryable) server rejection carries a 4xx status. */
const rejected = (status: number) => Object.assign(new Error("rejected"), { status });

function io(over: Partial<StopIo> = {}): StopIo {
  return {
    token: "tok",
    db: DB,
    sendStop: vi.fn().mockResolvedValue({ id: "stop-9" }),
    uploadPhoto: vi.fn().mockResolvedValue(undefined),
    del: vi.fn(),
    mirror: vi.fn(),
    queue: vi.fn(),
    ...over,
  };
}

describe("performSaveDeliveryStop (online-first)", () => {
  it("sends the stop, uploads+deletes every photo, and mirrors it", async () => {
    const d = io();
    const res = await performSaveDeliveryStop(INPUT, d);
    expect(res.id).toBe("stop-9");
    expect(d.sendStop).toHaveBeenCalledWith("srv-run-1", expect.objectContaining({ invoiceId: "inv-1", clientUuid: "u1" }), "tok");
    expect(d.uploadPhoto).toHaveBeenCalledTimes(2);
    expect(d.del).toHaveBeenCalledTimes(2);
    expect(d.mirror).toHaveBeenCalledOnce();
  });

  it("photo upload failure does NOT fail the save (still succeeds)", async () => {
    const d = io({ uploadPhoto: vi.fn().mockRejectedValue(new Error("500")) });
    expect((await performSaveDeliveryStop(INPUT, d)).id).toBe("stop-9");
    expect(d.del).not.toHaveBeenCalled(); // failed uploads keep their files
  });

  it("still succeeds when the local mirror throws (read-only DB)", async () => {
    const d = io({ mirror: vi.fn(() => { throw new Error("readonly"); }) });
    expect((await performSaveDeliveryStop(INPUT, d)).id).toBe("stop-9");
  });

  it("QUEUES when the network fails (offline-first fallback), never mirrors", async () => {
    const d = io({ sendStop: vi.fn().mockRejectedValue(new Error("offline")) });
    const res = await performSaveDeliveryStop(INPUT, d);
    expect(res.queued).toBe(true);
    expect(d.queue).toHaveBeenCalledOnce();
    expect(d.mirror).not.toHaveBeenCalled();
  });

  it("QUEUES the stop when the run has no server id yet (started offline), never sends", async () => {
    const d = io();
    const res = await performSaveDeliveryStop({ ...INPUT, runServerId: null }, d);
    expect(res.queued).toBe(true);
    expect(d.sendStop).not.toHaveBeenCalled();
    expect(d.queue).toHaveBeenCalledOnce();
  });

  it("throws on a permanent server rejection (4xx), does not queue", async () => {
    const d = io({ sendStop: vi.fn().mockRejectedValue(rejected(422)) });
    await expect(performSaveDeliveryStop(INPUT, d)).rejects.toThrow();
    expect(d.queue).not.toHaveBeenCalled();
  });
});
