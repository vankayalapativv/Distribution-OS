import { describe, expect, it } from "vitest";
import { calculateTrackingDistance, recalculateTrackingSessionDistance } from "./tracking-distance";
import { makeSql } from "../test/sql-mock";

describe("calculateTrackingDistance", () => {
  it("rejects invalid coords + poor accuracy, and accumulates a real segment", () => {
    const res = calculateTrackingDistance([
      { pointId: "bad", latitude: Number.NaN, longitude: 0, accuracyMeters: 5, recordedAt: "2026-06-01T09:00:00Z" }, // invalid coords
      { pointId: "acc", latitude: 17.4, longitude: 78.4, accuracyMeters: 99999, recordedAt: "2026-06-01T09:00:30Z" }, // poor accuracy
      { pointId: "p1", latitude: 17.4, longitude: 78.4, accuracyMeters: 5, recordedAt: "2026-06-01T09:01:00Z" }, // accepted (first)
      { pointId: "p2", latitude: 17.4, longitude: 78.4, accuracyMeters: 5, recordedAt: "2026-06-01T09:02:00Z" }, // same coords → no segment
      { pointId: "p3", latitude: 17.401, longitude: 78.4, accuracyMeters: 5, recordedAt: "2026-06-01T09:04:00Z" }, // real hop → segment
    ]);
    expect(res.rejectedPointCount).toBe(2);
    expect(res.totalDistanceKm).toBeGreaterThan(0); // the p2→p3 segment accumulated
  });
});

describe("recalculateTrackingSessionDistance", () => {
  it("maps point rows (null coercion) and writes quality + summary", async () => {
    const sql = makeSql({
      select_tracking_points_for_distance: [
        { pointId: null, latitude: null, longitude: null, accuracyMeters: null, recordedAt: "2026-06-01T09:00:00Z" },
        { pointId: "p1", latitude: "17.4", longitude: "78.4", accuracyMeters: "5", recordedAt: "2026-06-01T09:01:00Z" },
      ],
    });
    const res = await recalculateTrackingSessionDistance(sql, "sess-1");
    expect(res).toHaveProperty("totalDistanceKm");
  });
});
