import { describe, expect, test, vi } from "vitest";
import { flushGpsPings, insertGpsPing } from "./sync-core";
import { freshDb } from "./sync-core.test-support";

describe("gps pings (retry cap)", () => {
  test("a retried ping parks to 'failed' after the attempt cap", async () => {
    const db = freshDb();
    insertGpsPing(db, { latitude: 13, longitude: 80, accuracy: 5, batteryPercentage: 80, recordedAt: "2026-07-09T09:00:00.000Z" });
    db.run("update gps_pings set attempts = 4 where id = 1"); // one more attempt hits the cap of 5
    const lpid = db.first<{ location_point_id: string }>(
      "select location_point_id from gps_pings where id = 1",
    )!.location_point_id;

    const sendBatch = vi.fn().mockResolvedValue({ results: [{ locationPointId: lpid, status: "retry", reason: "TRANSIENT" }] });
    await flushGpsPings(db, sendBatch);

    expect(db.first("select sync_status, attempts, synced from gps_pings where id = 1")).toEqual({
      sync_status: "failed",
      attempts: 5,
      synced: 0,
    });
  });

  test("a retried ping under the cap stays 'retry' with an incremented attempt", async () => {
    const db = freshDb();
    insertGpsPing(db, { latitude: 13, longitude: 80, accuracy: 5, batteryPercentage: 80, recordedAt: "2026-07-09T09:00:00.000Z" });
    const lpid = db.first<{ location_point_id: string }>(
      "select location_point_id from gps_pings where id = 1",
    )!.location_point_id;

    const sendBatch = vi.fn().mockResolvedValue({ results: [{ locationPointId: lpid, status: "retry" }] });
    await flushGpsPings(db, sendBatch);

    expect(db.first("select sync_status, attempts from gps_pings where id = 1")).toEqual({
      sync_status: "retry",
      attempts: 1,
    });
  });
});
