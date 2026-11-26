import { describe, expect, test } from "vitest";
import { freshDb, NOW, RUN_UUID, seedRun } from "./sync-core.test-support";
import { mirrorEndedDeliveryRun, recordDeliveryEnd } from "./sync-core-delivery-end";

describe("recordDeliveryEnd", () => {
  test("closes the run locally and enqueues the end", () => {
    const db = freshDb();
    seedRun(db);
    recordDeliveryEnd(db, { runClientUuid: RUN_UUID, endOdometer: 48310, endPhotoPath: "file:///end.jpg" }, NOW);

    const run = db.first<{ status: string; end_odometer: number; end_photo_path: string; end_photo_uploaded: number }>(
      "select status, end_odometer, end_photo_path, end_photo_uploaded from delivery_runs where client_uuid = ?",
      [RUN_UUID],
    );
    expect(run).toMatchObject({ status: "ended", end_odometer: 48310, end_photo_path: "file:///end.jpg" });
    expect(run?.end_photo_uploaded).toBe(0);

    expect(db.all("select 1 from sync_queue where entity_type = 'delivery_end'")).toHaveLength(1);
  });
});

describe("mirrorEndedDeliveryRun", () => {
  test("marks the run ended with the photo uploaded and no queue", () => {
    const db = freshDb();
    seedRun(db);
    mirrorEndedDeliveryRun(db, { runClientUuid: RUN_UUID, endOdometer: 48300 }, NOW);

    const run = db.first<{ status: string; end_odometer: number; end_photo_uploaded: number }>(
      "select status, end_odometer, end_photo_uploaded from delivery_runs where client_uuid = ?",
      [RUN_UUID],
    );
    expect(run).toMatchObject({ status: "ended", end_odometer: 48300, end_photo_uploaded: 1 });
    expect(db.all("select 1 from sync_queue where entity_type = 'delivery_end'")).toHaveLength(0);
  });
});
