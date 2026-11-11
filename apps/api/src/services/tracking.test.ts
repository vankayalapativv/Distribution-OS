import { describe, expect, it } from "vitest";
import { assertTrackingDate, classifyTrackingFreshness, getExecutiveCheckins, listDeviceHealth } from "./tracking";
import { makeSql } from "../test/sql-mock";

const NOW = new Date("2026-06-01T12:00:00Z");
const ago = (min: number) => new Date(NOW.getTime() - min * 60000).toISOString();

describe("classifyTrackingFreshness", () => {
  const base = { sessionStatus: "active", lastHeartbeatAt: ago(1), isLocationEnabled: true, foregroundPermission: "granted", backgroundPermission: "granted", isConnected: true, queuedPointCount: 0, now: NOW };
  it("day_not_started when session isn't active", () => {
    expect(classifyTrackingFreshness({ ...base, sessionStatus: "pending", lastRecordedAt: null }).trackingStatus).toBe("day_not_started");
  });
  it("delayed between 5–8 min", () => {
    expect(classifyTrackingFreshness({ ...base, lastRecordedAt: ago(6) }).trackingStatus).toBe("delayed");
  });
  it("offline_upload_delayed when stale 9–15 min and disconnected", () => {
    expect(classifyTrackingFreshness({ ...base, lastRecordedAt: ago(10), isConnected: false }).trackingStatus).toBe("offline_upload_delayed");
  });
  it("permission_missing when foreground not granted", () => {
    expect(classifyTrackingFreshness({ ...base, lastRecordedAt: ago(1), foregroundPermission: "denied" }).trackingStatus).toBe("permission_missing");
  });
  it("signed_out when the latest signal is a sign-out", () => {
    expect(classifyTrackingFreshness({ ...base, lastRecordedAt: null, lastHeartbeatAt: null, signedOutAt: ago(1) }).trackingStatus).toBe("signed_out");
  });
  it("locating when active, reachable, but no GPS fix yet", () => {
    expect(classifyTrackingFreshness({ ...base, lastRecordedAt: null, lastHeartbeatAt: ago(1) }).trackingStatus).toBe("locating");
  });
  it("assertTrackingDate validates", () => {
    expect(assertTrackingDate("2026-06-01")).toBe("2026-06-01");
    expect(() => assertTrackingDate("bad")).toThrowError(/YYYY-MM-DD/);
  });
});

describe("listDeviceHealth", () => {
  it("maps a device-health row (nullable fields)", async () => {
    const sql = makeSql({ device_health: [{ userId: "se-1", name: "Asha", isLocationEnabled: "true", isConnected: "false", batteryPercentage: "80", queuedPointCount: null, todayPoints: "12", sessionStatus: "active" }] });
    const rows = await listDeviceHealth(sql, "2026-06-01");
    expect(rows[0]).toMatchObject({ userId: "se-1", isLocationEnabled: true, isConnected: false, queuedPointCount: 0, todayPoints: 12 });
  });
});

describe("getExecutiveCheckins", () => {
  it("maps check-ins with their order/collection arrays", async () => {
    const sql = makeSql({ tracking_checkins: [{ visitId: "v1", customerId: "c1", customerName: "Ravi", lat: "17.4", lng: "78.4", checkInAt: "2026-06-01T09:00:00Z", planned: "planned", orders: [{ id: "o1", code: "ORD-1", litres: "10" }], collections: [{ id: "col1", code: "COLL-1", amount: "500" }] }] });
    const rows = await getExecutiveCheckins(sql, "se-1", "2026-06-01");
    expect(rows[0]).toMatchObject({ visitId: "v1", planned: "planned" });
    expect(rows[0].orders[0]).toMatchObject({ code: "ORD-1", litres: 10 });
    expect(rows[0].collections[0]).toMatchObject({ amount: 500 });
  });
});
