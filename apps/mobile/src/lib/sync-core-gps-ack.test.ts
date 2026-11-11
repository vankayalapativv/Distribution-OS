import { describe, expect, test, vi } from "vitest";
import { flushGpsPings, insertGpsPing } from "./sync-core";
import { freshDb } from "./sync-core.test-support";

describe("gps pings (acknowledgements)", () => {
  test("flushGpsPings only marks accepted or duplicate point acknowledgements synced", async () => {
    const db = freshDb();
    insertGpsPing(db, { latitude: 13.08, longitude: 80.27, accuracy: 8, batteryPercentage: 90, recordedAt: "2026-07-09T09:00:00.000Z" });
    insertGpsPing(db, { latitude: 13.09, longitude: 80.28, accuracy: 9, batteryPercentage: 89, recordedAt: "2026-07-09T09:03:00.000Z" });
    insertGpsPing(db, { latitude: 13.1, longitude: 80.29, accuracy: 9, batteryPercentage: 88, recordedAt: "2026-07-09T09:06:00.000Z" });

    const rows = db.all<{ location_point_id: string }>(
      "select location_point_id from gps_pings order by id",
    );
    const sendBatch = vi.fn().mockResolvedValue({
      results: [
        { locationPointId: rows[0].location_point_id, status: "accepted" },
        { locationPointId: rows[1].location_point_id, status: "duplicate" },
        { locationPointId: rows[2].location_point_id, status: "rejected", reason: "INVALID_COORDINATES" },
      ],
    });

    const result = await flushGpsPings(db, sendBatch);

    expect(result.sent).toBe(2);
    expect(db.all("select id from gps_pings where synced = 0")).toHaveLength(1);
    const rejected = db.first<{ sync_status: string; rejection_reason: string | null }>(
      "select sync_status, rejection_reason from gps_pings where location_point_id = ?",
      [rows[2].location_point_id],
    );
    expect(rejected).toEqual({ sync_status: "rejected", rejection_reason: "INVALID_COORDINATES" });
  });

  test("malformed ack accepts only the sent points, never resurrecting out-of-batch rejected ones", async () => {
    const db = freshDb();
    // A previously-rejected ping still sits unsynced (synced = 0, 'rejected').
    insertGpsPing(db, { latitude: 13, longitude: 80, accuracy: 5, batteryPercentage: 80, recordedAt: "2026-07-09T09:00:00.000Z" });
    db.run("update gps_pings set sync_status = 'rejected', rejection_reason = 'BAD' where id = 1");
    // A fresh pending ping is what actually gets flushed.
    insertGpsPing(db, { latitude: 13.1, longitude: 80.1, accuracy: 5, batteryPercentage: 80, recordedAt: "2026-07-09T09:03:00.000Z" });

    const sendBatch = vi.fn().mockResolvedValue({ garbage: true }); // no results[] → fallback path
    const result = await flushGpsPings(db, sendBatch);

    expect(result.sent).toBe(1); // only the one pending point was in the batch
    // The out-of-batch rejected ping is untouched (the old id<=maxId range accepted it).
    expect(db.first("select sync_status, synced from gps_pings where id = 1")).toEqual({
      sync_status: "rejected",
      synced: 0,
    });
    expect(db.first("select sync_status, synced from gps_pings where id = 2")).toEqual({
      sync_status: "accepted",
      synced: 1,
    });
  });
});
