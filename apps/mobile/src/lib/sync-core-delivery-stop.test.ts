import { describe, expect, test } from "vitest";
import { freshDb, NOW, RUN_UUID, STOP_UUID, seedRun } from "./sync-core.test-support";
import { mirrorSentDeliveryStop, recordDeliveryStop } from "./sync-core-delivery-stop";

const STOP = {
  clientUuid: STOP_UUID,
  runClientUuid: RUN_UUID,
  customerId: "c1",
  customerName: "Balaji Auto",
  latitude: 17.25,
  longitude: 80.15,
  invoiceId: "inv-1",
  invoiceNumber: "INV-1",
  photoPaths: ["file:///a.jpg", "file:///b.jpg"],
};

describe("recordDeliveryStop", () => {
  test("writes the stop + enqueues it atomically", () => {
    const db = freshDb();
    seedRun(db);
    recordDeliveryStop(db, STOP, NOW);

    const row = db.first<{ customer_name: string; photo_paths: string; server_id: string | null; photos_uploaded: number }>(
      "select customer_name, photo_paths, server_id, photos_uploaded from delivery_stops where client_uuid = ?",
      [STOP_UUID],
    );
    expect(row).toMatchObject({ customer_name: "Balaji Auto", server_id: null });
    expect(JSON.parse(row!.photo_paths)).toEqual(["file:///a.jpg", "file:///b.jpg"]);
    expect(row?.photos_uploaded).toBe(0);

    const queued = db.all<{ entity_type: string }>("select entity_type from sync_queue where entity_type = 'delivery_stop'");
    expect(queued).toHaveLength(1);
  });
});

describe("mirrorSentDeliveryStop", () => {
  test("caches a server-saved stop as fully synced, no queue", () => {
    const db = freshDb();
    seedRun(db);
    mirrorSentDeliveryStop(db, { ...STOP, serverId: "srv-stop-1" }, NOW);

    const row = db.first<{ server_id: string; photos_uploaded: number }>(
      "select server_id, photos_uploaded from delivery_stops where client_uuid = ?",
      [STOP_UUID],
    );
    expect(row).toMatchObject({ server_id: "srv-stop-1", photos_uploaded: 1 });
    expect(db.all("select 1 from sync_queue where entity_type = 'delivery_stop'")).toHaveLength(0);
  });
});
