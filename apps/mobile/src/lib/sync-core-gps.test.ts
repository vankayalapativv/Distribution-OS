import { describe, expect, test, vi } from "vitest";
import { flushGpsPings, insertGpsPing } from "./sync-core";
import { freshDb } from "./sync-core.test-support";

describe("gps pings (insert + flush)", () => {
  test("insertGpsPing creates a stable locationPointId before upload", () => {
    const db = freshDb();
    insertGpsPing(db, {
      clientSessionId: "session-client-1",
      latitude: 13.08,
      longitude: 80.27,
      accuracy: 8,
      batteryPercentage: 90,
      recordedAt: "2026-07-09T09:00:00.000Z",
    });

    const row = db.first<{ location_point_id: string; client_session_id: string; created_at: number }>(
      "select location_point_id, client_session_id, created_at from gps_pings",
    );
    expect(row?.location_point_id).toMatch(/[0-9a-f-]{36}/);
    expect(row?.client_session_id).toBe("session-client-1");
    expect(row?.created_at).toBeGreaterThan(0);
  });

  test("flushGpsPings sends unsynced points in one batch and marks them synced", async () => {
    const db = freshDb();
    insertGpsPing(db, { latitude: 13.08, longitude: 80.27, accuracy: 8, batteryPercentage: 90, recordedAt: "2026-07-09T09:00:00.000Z" });
    insertGpsPing(db, { latitude: 13.09, longitude: 80.28, accuracy: 9, batteryPercentage: 89, recordedAt: "2026-07-09T09:05:00.000Z" });

    const sendBatch = vi.fn().mockResolvedValue(undefined);
    const result = await flushGpsPings(db, sendBatch);

    expect(sendBatch).toHaveBeenCalledTimes(1);
    expect(sendBatch.mock.calls[0][0]).toHaveLength(2);
    expect(result.sent).toBe(2);

    const unsynced = db.all("select id from gps_pings where synced = 0");
    expect(unsynced).toHaveLength(0);
  });

  test("failed batch leaves pings unsynced", async () => {
    const db = freshDb();
    insertGpsPing(db, { latitude: 13.08, longitude: 80.27, accuracy: null, batteryPercentage: null, recordedAt: "2026-07-09T09:00:00.000Z" });

    const sendBatch = vi.fn().mockRejectedValue(new Error("offline"));
    const result = await flushGpsPings(db, sendBatch);

    expect(result.sent).toBe(0);
    expect(db.all("select id from gps_pings where synced = 0")).toHaveLength(1);
  });

  test("no-op when nothing is queued", async () => {
    const db = freshDb();
    const sendBatch = vi.fn();
    const result = await flushGpsPings(db, sendBatch);
    expect(result.sent).toBe(0);
    expect(sendBatch).not.toHaveBeenCalled();
  });
});
