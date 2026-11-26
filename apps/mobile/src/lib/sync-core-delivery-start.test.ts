import { describe, expect, test } from "vitest";
import { freshDb, NOW, RUN_SERVER_ID, RUN_UUID } from "./sync-core.test-support";
import { mirrorStartedDeliveryRun, recordDeliveryStart } from "./sync-core-delivery-start";

const INPUT = {
  clientUuid: RUN_UUID,
  vehicleNumber: "TS09AB1234",
  startOdometer: 48210,
  runDate: "2026-07-15",
  startPhotoPath: "file:///start.jpg",
};

describe("recordDeliveryStart", () => {
  test("writes an active run and enqueues the start", () => {
    const db = freshDb();
    recordDeliveryStart(db, INPUT, NOW);

    const run = db.first<{ status: string; start_photo_path: string; start_photo_uploaded: number; server_id: string | null }>(
      "select status, start_photo_path, start_photo_uploaded, server_id from delivery_runs where client_uuid = ?",
      [RUN_UUID],
    );
    expect(run).toMatchObject({ status: "active", start_photo_path: "file:///start.jpg", server_id: null });
    expect(run?.start_photo_uploaded).toBe(0);

    const queued = db.all<{ entity_type: string; client_uuid: string }>(
      "select entity_type, client_uuid from sync_queue",
    );
    expect(queued).toEqual([{ entity_type: "delivery_start", client_uuid: RUN_UUID }]);
  });
});

describe("mirrorStartedDeliveryRun", () => {
  test("stores the run with its server id, photo already uploaded, no queue", () => {
    const db = freshDb();
    mirrorStartedDeliveryRun(db, { ...INPUT, serverId: RUN_SERVER_ID }, NOW);

    const run = db.first<{ status: string; server_id: string; start_photo_uploaded: number }>(
      "select status, server_id, start_photo_uploaded from delivery_runs where client_uuid = ?",
      [RUN_UUID],
    );
    expect(run).toMatchObject({ status: "active", server_id: RUN_SERVER_ID });
    expect(run?.start_photo_uploaded).toBe(1);
    expect(db.all("select 1 from sync_queue")).toHaveLength(0);
  });
});
