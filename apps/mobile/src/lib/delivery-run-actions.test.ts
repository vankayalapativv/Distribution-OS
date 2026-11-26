import { describe, expect, it, vi } from "vitest";
import { performEndRun, performStartRun, type EndRunIo, type StartRunIo } from "./delivery-run-actions";
import type { LocalDb } from "./local-db";

const DB = {} as LocalDb;
const START = { clientUuid: "u1", vehicleNumber: "TS09AB1234", startOdometer: 100, runDate: "2026-08-15", startPhotoPath: "s.jpg" };
const END = { runClientUuid: "u1", endOdometer: 200, endPhotoPath: "e.jpg", runServerId: "srv-1" };

/** A permanent (non-retryable) server rejection carries a 4xx status. */
const rejected = (status: number) => Object.assign(new Error("rejected"), { status });

function startIo(over: Partial<StartRunIo> = {}): StartRunIo {
  return {
    token: "tok", db: DB,
    send: vi.fn().mockResolvedValue({ id: "srv-1" }),
    mirror: vi.fn(), upload: vi.fn().mockResolvedValue(undefined), del: vi.fn(), queue: vi.fn(), ...over,
  };
}
function endIo(over: Partial<EndRunIo> = {}): EndRunIo {
  return {
    token: "tok", db: DB,
    send: vi.fn().mockResolvedValue({ id: "srv-1" }),
    upload: vi.fn().mockResolvedValue(undefined), del: vi.fn(), mirror: vi.fn(), queue: vi.fn(), ...over,
  };
}

describe("performStartRun (online-first)", () => {
  it("sends, mirrors, and uploads+deletes the photo", async () => {
    const io = startIo();
    const res = await performStartRun(START, io);
    expect(res.id).toBe("srv-1");
    expect(io.mirror).toHaveBeenCalledOnce();
    expect(io.upload).toHaveBeenCalledWith("srv-1", "s.jpg", "tok");
    expect(io.del).toHaveBeenCalledWith("s.jpg");
    expect(io.queue).not.toHaveBeenCalled();
  });

  it("keeps the photo when its upload fails (proof, not the record) but still succeeds", async () => {
    const io = startIo({ upload: vi.fn().mockRejectedValue(new Error("500")) });
    expect((await performStartRun(START, io)).id).toBe("srv-1");
    expect(io.del).not.toHaveBeenCalled();
  });

  it("still succeeds when the local mirror throws (read-only DB)", async () => {
    const io = startIo({ mirror: vi.fn(() => { throw new Error("readonly"); }) });
    expect((await performStartRun(START, io)).id).toBe("srv-1");
  });

  it("QUEUES when the network fails (offline-first fallback), never mirrors", async () => {
    const io = startIo({ send: vi.fn().mockRejectedValue(new Error("offline")) });
    const res = await performStartRun(START, io);
    expect(res.queued).toBe(true);
    expect(io.queue).toHaveBeenCalledOnce();
    expect(io.mirror).not.toHaveBeenCalled();
  });

  it("throws on a permanent server rejection (4xx), does not queue", async () => {
    const io = startIo({ send: vi.fn().mockRejectedValue(rejected(422)) });
    await expect(performStartRun(START, io)).rejects.toThrow();
    expect(io.queue).not.toHaveBeenCalled();
  });

  it("sends but skips the mirror when there's no local db", async () => {
    const io = startIo({ db: null });
    expect((await performStartRun(START, io)).id).toBe("srv-1");
    expect(io.mirror).not.toHaveBeenCalled();
  });

  it("reports a device error when offline with no local db (unsaved)", async () => {
    const io = startIo({ db: null, send: vi.fn().mockRejectedValue(new Error("offline")) });
    await expect(performStartRun(START, io)).rejects.toThrow(/on this device/);
  });
});

describe("performEndRun (online-first)", () => {
  it("ends, uploads+deletes the photo, and mirrors the close", async () => {
    const io = endIo();
    const res = await performEndRun(END, io);
    expect(res.id).toBe("srv-1");
    expect(io.send).toHaveBeenCalledWith("srv-1", { runClientUuid: "u1", endOdometer: 200 }, "tok");
    expect(io.del).toHaveBeenCalledWith("e.jpg");
    expect(io.mirror).toHaveBeenCalledOnce();
  });

  it("QUEUES the end when the run has no server id yet (started offline), never sends", async () => {
    const io = endIo();
    const res = await performEndRun({ ...END, runServerId: null }, io);
    expect(res.queued).toBe(true);
    expect(io.send).not.toHaveBeenCalled();
    expect(io.queue).toHaveBeenCalledOnce();
  });

  it("QUEUES when the network fails, never mirrors", async () => {
    const io = endIo({ send: vi.fn().mockRejectedValue(new Error("offline")) });
    const res = await performEndRun(END, io);
    expect(res.queued).toBe(true);
    expect(io.queue).toHaveBeenCalledOnce();
    expect(io.mirror).not.toHaveBeenCalled();
  });

  it("errors when the run has no server id and no local db to queue to", async () => {
    const io = endIo({ db: null });
    await expect(performEndRun({ ...END, runServerId: null }, io)).rejects.toThrow(/on this device/);
  });

  it("ends but skips the mirror when there's no local db", async () => {
    const io = endIo({ db: null });
    expect((await performEndRun(END, io)).id).toBe("srv-1");
    expect(io.mirror).not.toHaveBeenCalled();
  });

  it("reports a device error when offline with no local db (unsaved)", async () => {
    const io = endIo({ db: null, send: vi.fn().mockRejectedValue(new Error("offline")) });
    await expect(performEndRun(END, io)).rejects.toThrow(/on this device/);
  });

  it("throws on a permanent server rejection (4xx)", async () => {
    const io = endIo({ send: vi.fn().mockRejectedValue(rejected(422)) });
    await expect(performEndRun(END, io)).rejects.toThrow(/server rejected/);
    expect(io.queue).not.toHaveBeenCalled();
  });
});
