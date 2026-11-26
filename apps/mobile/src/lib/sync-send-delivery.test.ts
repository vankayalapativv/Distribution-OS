import { afterEach, describe, expect, it, vi } from "vitest";
import { freshDb, NOW, RUN_SERVER_ID, RUN_UUID } from "./sync-core.test-support";
import { mirrorStartedDeliveryRun, recordDeliveryStart } from "./sync-core-delivery-start";
import { recordDeliveryEnd } from "./sync-core-delivery-end";
import { sendDeliveryEnd, sendDeliveryStart } from "./sync-send-delivery";
import type { SyncQueueItem } from "./sync-core";

const sendStartRun = vi.fn();
const sendEndRun = vi.fn();
const uploadDeliveryPhoto = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const deleteProofPhoto = vi.fn();
vi.mock("./delivery-remote", () => ({
  sendStartRun: (...a: unknown[]) => sendStartRun(...a),
  sendEndRun: (...a: unknown[]) => sendEndRun(...a),
}));
vi.mock("./photo-upload", () => ({ uploadDeliveryPhoto: (...a: unknown[]) => uploadDeliveryPhoto(...a) }));
vi.mock("./photo-files", () => ({ deleteProofPhoto: (...a: unknown[]) => deleteProofPhoto(...a) }));

const START_INPUT = { clientUuid: RUN_UUID, vehicleNumber: "TS09AB1234", startOdometer: 48210, runDate: "2026-07-15", startPhotoPath: "file:///start.jpg" };
function item(over: Partial<SyncQueueItem> = {}): SyncQueueItem {
  return { id: 1, clientUuid: RUN_UUID, entityType: "delivery_start", payload: {}, attempts: 0, ...over };
}

afterEach(() => vi.clearAllMocks());

describe("sendDeliveryStart", () => {
  it("POSTs the start, uploads the odometer photo, marks it uploaded and deletes it", async () => {
    const db = freshDb();
    recordDeliveryStart(db, START_INPUT, NOW);
    sendStartRun.mockResolvedValue({ id: "srv-run-9" });

    const res = await sendDeliveryStart(item({ payload: { clientUuid: RUN_UUID } }), db, "tok");
    expect(res).toEqual({ id: "srv-run-9" });
    expect(uploadDeliveryPhoto).toHaveBeenCalledWith("srv-run-9", "file:///start.jpg", "start_odometer", null, "tok");
    expect(db.first<{ start_photo_uploaded: number }>("select start_photo_uploaded from delivery_runs where client_uuid = ?", [RUN_UUID])?.start_photo_uploaded).toBe(1);
    expect(deleteProofPhoto).toHaveBeenCalledWith("file:///start.jpg");
  });

  it("skips the photo when the server returns no run id", async () => {
    const db = freshDb();
    recordDeliveryStart(db, START_INPUT, NOW);
    sendStartRun.mockResolvedValue({});
    await sendDeliveryStart(item(), db, "tok");
    expect(uploadDeliveryPhoto).not.toHaveBeenCalled();
  });

  it("skips the photo when it was already uploaded", async () => {
    const db = freshDb();
    mirrorStartedDeliveryRun(db, { ...START_INPUT, serverId: RUN_SERVER_ID }, NOW); // uploaded = 1
    sendStartRun.mockResolvedValue({ id: "srv-run-9" });
    await sendDeliveryStart(item(), db, "tok");
    expect(uploadDeliveryPhoto).not.toHaveBeenCalled();
  });

  it("skips the photo when there is no local run row for the item", async () => {
    const db = freshDb();
    sendStartRun.mockResolvedValue({ id: "srv-run-9" });
    await sendDeliveryStart(item({ clientUuid: "missing" }), db, "tok");
    expect(uploadDeliveryPhoto).not.toHaveBeenCalled();
  });
});

describe("sendDeliveryEnd", () => {
  function seedEndableRun(db: ReturnType<typeof freshDb>) {
    mirrorStartedDeliveryRun(db, { ...START_INPUT, serverId: RUN_SERVER_ID }, NOW);
    recordDeliveryEnd(db, { runClientUuid: RUN_UUID, endOdometer: 48310, endPhotoPath: "file:///end.jpg" }, NOW);
  }

  it("throws (retryable) until the run's start has synced a server id", async () => {
    const db = freshDb();
    recordDeliveryStart(db, START_INPUT, NOW); // no server_id yet
    await expect(
      sendDeliveryEnd(item({ entityType: "delivery_end", payload: { runClientUuid: RUN_UUID, endOdometer: 48310 } }), db, "tok"),
    ).rejects.toThrow(/has not synced yet/);
  });

  it("treats a missing runClientUuid as unsynced and throws", async () => {
    const db = freshDb();
    await expect(
      sendDeliveryEnd(item({ entityType: "delivery_end", payload: { endOdometer: 1 } }), db, "tok"),
    ).rejects.toThrow(/has not synced yet/);
  });

  it("POSTs the end against the server id and uploads the end photo", async () => {
    const db = freshDb();
    seedEndableRun(db);
    sendEndRun.mockResolvedValue({ ok: true });
    const res = await sendDeliveryEnd(
      item({ entityType: "delivery_end", payload: { runClientUuid: RUN_UUID, endOdometer: 48310 } }),
      db,
      "tok",
    );
    expect(res).toEqual({ ok: true });
    expect(sendEndRun).toHaveBeenCalledWith(RUN_SERVER_ID, { runClientUuid: RUN_UUID, endOdometer: 48310 }, "tok");
    expect(uploadDeliveryPhoto).toHaveBeenCalledWith(RUN_SERVER_ID, "file:///end.jpg", "end_odometer", null, "tok");
    expect(db.first<{ end_photo_uploaded: number }>("select end_photo_uploaded from delivery_runs where client_uuid = ?", [RUN_UUID])?.end_photo_uploaded).toBe(1);
  });

  it("defaults a non-numeric/missing odometer and runClientUuid defensively", async () => {
    const db = freshDb();
    mirrorStartedDeliveryRun(db, { ...START_INPUT, serverId: RUN_SERVER_ID }, NOW);
    // no end photo path → skip upload branch
    sendEndRun.mockResolvedValue({});
    await sendDeliveryEnd(item({ entityType: "delivery_end", payload: { runClientUuid: RUN_UUID, endOdometer: "bad" } }), db, "tok");
    expect(sendEndRun).toHaveBeenCalledWith(RUN_SERVER_ID, { runClientUuid: RUN_UUID, endOdometer: 0 }, "tok");
    expect(uploadDeliveryPhoto).not.toHaveBeenCalled();
  });
});
