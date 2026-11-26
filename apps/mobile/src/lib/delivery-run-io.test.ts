import { afterEach, describe, expect, it, vi } from "vitest";
import { endRunIo, startRunIo } from "./delivery-run-io";

const getLocalDb = vi.fn<() => unknown>(() => ({ id: "db" }));
const sendStartRun = vi.fn();
const sendEndRun = vi.fn();
const uploadDeliveryPhoto = vi.fn();
const deleteProofPhoto = vi.fn();
const kickSync = vi.fn();
const mirrorStartedDeliveryRun = vi.fn();
const mirrorEndedDeliveryRun = vi.fn();
const recordDeliveryStart = vi.fn();
const recordDeliveryEnd = vi.fn();

vi.mock("./db", () => ({ getLocalDb: () => getLocalDb() }));
vi.mock("./delivery-remote", () => ({
  sendStartRun: (...a: unknown[]) => sendStartRun(...a),
  sendEndRun: (...a: unknown[]) => sendEndRun(...a),
}));
vi.mock("./photos", () => ({
  uploadDeliveryPhoto: (...a: unknown[]) => uploadDeliveryPhoto(...a),
  deleteProofPhoto: (...a: unknown[]) => deleteProofPhoto(...a),
}));
vi.mock("./sync", () => ({ kickSync: (...a: unknown[]) => kickSync(...a) }));
vi.mock("./sync-core", () => ({
  mirrorStartedDeliveryRun: (...a: unknown[]) => mirrorStartedDeliveryRun(...a),
  mirrorEndedDeliveryRun: (...a: unknown[]) => mirrorEndedDeliveryRun(...a),
  recordDeliveryStart: (...a: unknown[]) => recordDeliveryStart(...a),
  recordDeliveryEnd: (...a: unknown[]) => recordDeliveryEnd(...a),
}));

afterEach(() => vi.clearAllMocks());

describe("startRunIo", () => {
  it("carries token + db and wires send/mirror", () => {
    const db = { id: "live" };
    getLocalDb.mockReturnValue(db);
    const io = startRunIo("tok");
    expect(io.token).toBe("tok");
    expect(io.db).toBe(db);
    io.send("payload" as never, "t" as never);
    expect(sendStartRun).toHaveBeenCalledWith("payload", "t");
    io.mirror({} as never, { a: 1 } as never, 0);
    expect(mirrorStartedDeliveryRun).toHaveBeenCalledWith({}, { a: 1 }, 0);
  });

  it("uploads the start-odometer photo", () => {
    startRunIo("tok").upload("run-1", "file://o.jpg", "t");
    expect(uploadDeliveryPhoto).toHaveBeenCalledWith("run-1", "file://o.jpg", "start_odometer", null, "t");
  });

  it("del wires deleteProofPhoto; queue records + syncs", () => {
    const io = startRunIo("tok");
    io.del("k");
    expect(deleteProofPhoto).toHaveBeenCalledWith("k");
    io.queue({ id: "db" } as never, { clientUuid: "u" } as never, 10);
    expect(recordDeliveryStart).toHaveBeenCalledWith({ id: "db" }, { clientUuid: "u" }, 10);
    expect(kickSync).toHaveBeenCalledOnce();
  });
});

describe("endRunIo", () => {
  it("carries token + db and wires send/mirror", () => {
    const io = endRunIo("tok");
    expect(io.token).toBe("tok");
    io.send("srv" as never, "payload" as never, "t" as never);
    expect(sendEndRun).toHaveBeenCalledWith("srv", "payload", "t");
    io.mirror({} as never, { b: 2 } as never, 0);
    expect(mirrorEndedDeliveryRun).toHaveBeenCalledWith({}, { b: 2 }, 0);
  });

  it("uploads the end-odometer photo", () => {
    endRunIo("tok").upload("run-1", "file://e.jpg", "t");
    expect(uploadDeliveryPhoto).toHaveBeenCalledWith("run-1", "file://e.jpg", "end_odometer", null, "t");
  });

  it("del wires deleteProofPhoto; queue records + syncs", () => {
    const io = endRunIo("tok");
    io.del("k");
    expect(deleteProofPhoto).toHaveBeenCalledWith("k");
    io.queue({ id: "db" } as never, { clientUuid: "u" } as never, 20);
    expect(recordDeliveryEnd).toHaveBeenCalledWith({ id: "db" }, { clientUuid: "u" }, 20);
    expect(kickSync).toHaveBeenCalledOnce();
  });
});
