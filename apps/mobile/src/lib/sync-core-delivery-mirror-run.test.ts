import { describe, expect, test } from "vitest";
import { getActiveDeliveryRun, mirrorEndedDeliveryRun, mirrorStartedDeliveryRun } from "./sync-core";
import { freshDb, NOW, RUN_UUID, seedRun } from "./sync-core.test-support";

describe("delivery runs (mirror run)", () => {
  test("mirrorStartedDeliveryRun caches an online-started run with its server id", () => {
    const db = freshDb();
    mirrorStartedDeliveryRun(
      db,
      {
        clientUuid: RUN_UUID,
        vehicleNumber: "TS07AB1234",
        startOdometer: 100,
        runDate: "2026-07-09",
        startPhotoPath: "start.jpg",
        serverId: "srv-run-9",
      },
      NOW,
    );
    const run = getActiveDeliveryRun(db);
    expect(run?.clientUuid).toBe(RUN_UUID);
    expect(run?.serverId).toBe("srv-run-9"); // stop writes can target the server immediately
    expect(run?.vehicleNumber).toBe("TS07AB1234");
    const row = db.first<{ start_photo_uploaded: number }>(
      "select start_photo_uploaded from delivery_runs where client_uuid = ?",
      [RUN_UUID],
    );
    expect(row?.start_photo_uploaded).toBe(1);
  });

  test("mirrorEndedDeliveryRun marks the run ended locally", () => {
    const db = freshDb();
    seedRun(db); // active run mirrored from the server
    mirrorEndedDeliveryRun(db, { runClientUuid: RUN_UUID, endOdometer: 240 }, NOW + 9000);
    expect(getActiveDeliveryRun(db)).toBeNull(); // no longer active
    const row = db.first<{ status: string; end_odometer: number; end_photo_uploaded: number }>(
      "select status, end_odometer, end_photo_uploaded from delivery_runs where client_uuid = ?",
      [RUN_UUID],
    );
    expect(row?.status).toBe("ended");
    expect(row?.end_odometer).toBe(240);
    expect(row?.end_photo_uploaded).toBe(1);
  });
});
