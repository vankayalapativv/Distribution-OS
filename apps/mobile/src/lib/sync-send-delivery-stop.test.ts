import { afterEach, describe, expect, it, vi } from "vitest";
import { freshDb, NOW, RUN_SERVER_ID, RUN_UUID, STOP_UUID } from "./sync-core.test-support";
import { mirrorStartedDeliveryRun, recordDeliveryStart } from "./sync-core-delivery-start";
import { mirrorSentDeliveryStop, recordDeliveryStop } from "./sync-core-delivery-stop";
import { sendDeliveryStop } from "./sync-send-delivery-stop";
import type { SyncQueueItem } from "./sync-core";

const sendAddStop = vi.fn();
const uploadDeliveryPhoto = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const deleteProofPhoto = vi.fn();
vi.mock("./delivery-remote", () => ({ sendAddStop: (...a: unknown[]) => sendAddStop(...a) }));
vi.mock("./photo-upload", () => ({ uploadDeliveryPhoto: (...a: unknown[]) => uploadDeliveryPhoto(...a) }));
vi.mock("./photo-files", () => ({ deleteProofPhoto: (...a: unknown[]) => deleteProofPhoto(...a) }));

const START = { clientUuid: RUN_UUID, vehicleNumber: "TS09AB1234", startOdometer: 48210, runDate: "2026-07-15", startPhotoPath: "file:///start.jpg" };
const STOP = {
  clientUuid: STOP_UUID, runClientUuid: RUN_UUID, customerId: "c1", customerName: "Balaji",
  latitude: 17.25, longitude: 80.15, invoiceId: "inv-1", invoiceNumber: "INV-1", photoPaths: ["file:///a.jpg", "file:///b.jpg"],
};
function item(over: Partial<SyncQueueItem> = {}): SyncQueueItem {
  return { id: 1, clientUuid: STOP_UUID, entityType: "delivery_stop", payload: { runClientUuid: RUN_UUID, customerId: "c1" }, attempts: 0, ...over };
}
function syncedRun(db: ReturnType<typeof freshDb>) {
  mirrorStartedDeliveryRun(db, { ...START, serverId: RUN_SERVER_ID }, NOW);
}

afterEach(() => vi.clearAllMocks());

describe("sendDeliveryStop", () => {
  it("throws (retryable) until the run has a server id", async () => {
    const db = freshDb();
    recordDeliveryStart(db, START, NOW); // run has no server_id
    recordDeliveryStop(db, STOP, NOW);
    await expect(sendDeliveryStop(item(), db, "tok")).rejects.toThrow(/has not synced yet/);
  });

  it("treats a missing runClientUuid as unsynced and throws", async () => {
    const db = freshDb();
    await expect(sendDeliveryStop(item({ payload: { customerId: "c1" } }), db, "tok")).rejects.toThrow(/has not synced yet/);
  });

  it("POSTs the stop, uploads each photo with geo, clears them, marks uploaded", async () => {
    const db = freshDb();
    syncedRun(db);
    recordDeliveryStop(db, STOP, NOW);
    sendAddStop.mockResolvedValue({ id: "srv-stop-1" });

    const res = await sendDeliveryStop(item(), db, "tok");
    expect(res).toEqual({ id: "srv-stop-1" });
    expect(sendAddStop).toHaveBeenCalledWith(RUN_SERVER_ID, item().payload, "tok");
    expect(uploadDeliveryPhoto).toHaveBeenNthCalledWith(1, RUN_SERVER_ID, "file:///a.jpg", "delivery", "srv-stop-1", "tok", { latitude: 17.25, longitude: 80.15 });
    expect(uploadDeliveryPhoto).toHaveBeenNthCalledWith(2, RUN_SERVER_ID, "file:///b.jpg", "delivery", "srv-stop-1", "tok", { latitude: 17.25, longitude: 80.15 });
    expect(deleteProofPhoto).toHaveBeenCalledTimes(2);

    const row = db.first<{ photos_uploaded: number; photo_paths: string }>(
      "select photos_uploaded, photo_paths from delivery_stops where client_uuid = ?",
      [STOP_UUID],
    );
    expect(row?.photos_uploaded).toBe(1);
    expect(JSON.parse(row!.photo_paths)).toEqual([]);
  });

  it("skips photo uploads when the server returns no stop id", async () => {
    const db = freshDb();
    syncedRun(db);
    recordDeliveryStop(db, STOP, NOW);
    sendAddStop.mockResolvedValue({});
    await sendDeliveryStop(item(), db, "tok");
    expect(uploadDeliveryPhoto).not.toHaveBeenCalled();
  });

  it("skips when the stop row is already fully uploaded", async () => {
    const db = freshDb();
    syncedRun(db);
    mirrorSentDeliveryStop(db, { ...STOP, serverId: "srv-stop-1" }, NOW); // photos_uploaded = 1
    sendAddStop.mockResolvedValue({ id: "srv-stop-1" });
    await sendDeliveryStop(item(), db, "tok");
    expect(uploadDeliveryPhoto).not.toHaveBeenCalled();
  });

  it("skips when there is no local stop row for the item", async () => {
    const db = freshDb();
    syncedRun(db);
    sendAddStop.mockResolvedValue({ id: "srv-stop-1" });
    await sendDeliveryStop(item({ clientUuid: "missing" }), db, "tok");
    expect(uploadDeliveryPhoto).not.toHaveBeenCalled();
  });

  it("marks uploaded with no uploads when the stored photo JSON is malformed", async () => {
    const db = freshDb();
    syncedRun(db);
    db.run(
      `insert into delivery_stops (client_uuid, run_client_uuid, customer_id, customer_name, photo_paths, photos_uploaded, created_at)
       values (?, ?, 'c1', 'X', 'not-json', 0, ?)`,
      [STOP_UUID, RUN_UUID, NOW],
    );
    sendAddStop.mockResolvedValue({ id: "srv-stop-1" });
    await sendDeliveryStop(item(), db, "tok");
    expect(uploadDeliveryPhoto).not.toHaveBeenCalled();
    expect(db.first<{ photos_uploaded: number }>("select photos_uploaded from delivery_stops where client_uuid = ?", [STOP_UUID])?.photos_uploaded).toBe(1);
  });
});
