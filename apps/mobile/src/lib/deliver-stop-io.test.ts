import { afterEach, describe, expect, it, vi } from "vitest";
import { stopIo } from "./deliver-stop-io";

const getLocalDb = vi.fn<() => unknown>(() => ({ id: "db" }));
const sendAddStop = vi.fn();
const uploadDeliveryPhoto = vi.fn();
const deleteProofPhoto = vi.fn();
const kickSync = vi.fn();
const mirrorSentDeliveryStop = vi.fn();
const recordDeliveryStop = vi.fn();

vi.mock("./db", () => ({ getLocalDb: () => getLocalDb() }));
vi.mock("./delivery-remote", () => ({ sendAddStop: (...a: unknown[]) => sendAddStop(...a) }));
vi.mock("./photos", () => ({
  uploadDeliveryPhoto: (...a: unknown[]) => uploadDeliveryPhoto(...a),
  deleteProofPhoto: (...a: unknown[]) => deleteProofPhoto(...a),
}));
vi.mock("./sync", () => ({ kickSync: (...a: unknown[]) => kickSync(...a) }));
vi.mock("./sync-core", () => ({
  mirrorSentDeliveryStop: (...a: unknown[]) => mirrorSentDeliveryStop(...a),
  recordDeliveryStop: (...a: unknown[]) => recordDeliveryStop(...a),
}));

afterEach(() => vi.clearAllMocks());

describe("stopIo", () => {
  it("carries the token and the current local db", () => {
    const db = { id: "live" };
    getLocalDb.mockReturnValue(db);
    const io = stopIo("tok");
    expect(io.token).toBe("tok");
    expect(io.db).toBe(db);
  });

  it("wires sendStop → sendAddStop", () => {
    const io = stopIo("tok");
    const body = { foo: 1 };
    io.sendStop("run-1", body as never, "t");
    expect(sendAddStop).toHaveBeenCalledWith("run-1", body, "t");
  });

  it("wires uploadPhoto → uploadDeliveryPhoto under the delivery category", () => {
    const io = stopIo("tok");
    const geo = { latitude: 1, longitude: 2 };
    io.uploadPhoto("run-1", "file://p.jpg", "stop-1", "t", geo as never);
    expect(uploadDeliveryPhoto).toHaveBeenCalledWith("run-1", "file://p.jpg", "delivery", "stop-1", "t", geo);
  });

  it("wires del → deleteProofPhoto", () => {
    stopIo("tok").del("key");
    expect(deleteProofPhoto).toHaveBeenCalledWith("key");
  });

  it("wires mirror → mirrorSentDeliveryStop", () => {
    stopIo("tok").mirror({} as never, { a: 1 } as never, 0);
    expect(mirrorSentDeliveryStop).toHaveBeenCalledWith({}, { a: 1 }, 0);
  });

  it("queue records the stop and kicks a sync", () => {
    const io = stopIo("tok");
    const db = { id: "db" };
    const input = { clientUuid: "u" };
    io.queue(db as never, input as never, 123);
    expect(recordDeliveryStop).toHaveBeenCalledWith(db, input, 123);
    expect(kickSync).toHaveBeenCalledOnce();
  });
});
