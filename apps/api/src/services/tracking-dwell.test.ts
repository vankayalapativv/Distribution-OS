import { describe, expect, it } from "vitest";
import { detectCustomerDwell, recalculateTrackingSessionDwell } from "./tracking-dwell";
import { makeSql } from "../test/sql-mock";

describe("detectCustomerDwell", () => {
  it("returns no events for empty input", () => {
    expect(detectCustomerDwell({ customers: [], points: [] })).toEqual([]);
  });
});

describe("recalculateTrackingSessionDwell", () => {
  it("returns [] when the session is missing", async () => {
    expect(await recalculateTrackingSessionDwell(makeSql({ select_tracking_session_for_dwell: [] }), "x")).toEqual([]);
  });
  it("maps customer/point rows (string + null coercion) with no dwell events", async () => {
    const sql = makeSql({
      select_tracking_session_for_dwell: [{ sessionId: "s1", userId: "u1" }],
      // string coords exercise num()'s string branch; the far-away point yields no dwell
      select_customers_for_dwell: [{ customerId: "c1", customerName: null, latitude: "17.4", longitude: "78.4" }],
      select_tracking_points_for_dwell: [{ pointId: "p1", latitude: "10.0", longitude: "70.0", accuracyMeters: null, recordedAt: "2026-06-01T09:00:00Z" }],
    });
    expect(await recalculateTrackingSessionDwell(sql, "s1")).toEqual([]);
  });
});
