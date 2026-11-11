import { describe, expect, test } from "vitest";
import { buildTrackingHeartbeat, getGpsHeartbeatState, insertGpsPing } from "./sync-core";
import { freshDb } from "./sync-core.test-support";

describe("gps heartbeat", () => {
  test("getGpsHeartbeatState reports queued point count and latest location time", () => {
    const db = freshDb();
    insertGpsPing(db, { latitude: 13.08, longitude: 80.27, accuracy: 8, batteryPercentage: 90, recordedAt: "2026-07-09T09:00:00.000Z" });
    insertGpsPing(db, { latitude: 13.09, longitude: 80.28, accuracy: 9, batteryPercentage: 89, recordedAt: "2026-07-09T09:03:00.000Z" });
    db.run("update gps_pings set synced = 1, sync_status = 'accepted' where id = 1");

    expect(getGpsHeartbeatState(db)).toEqual({
      queuedPointCount: 1,
      lastLocationAt: "2026-07-09T09:03:00.000Z",
    });
  });

  test("buildTrackingHeartbeat includes device health and local queue health", () => {
    const payload = buildTrackingHeartbeat({
      capturedAt: "2026-07-09T09:06:00.000Z",
      queue: { queuedPointCount: 3, lastLocationAt: "2026-07-09T09:03:00.000Z" },
      device: {
        deviceId: "android-1",
        isLocationEnabled: true,
        foregroundPermission: "granted",
        backgroundPermission: "granted",
        notificationPermission: "granted",
        networkType: "cellular",
        isConnected: true,
        appVersion: "1.4.0",
        androidVersion: "15",
        manufacturer: "Samsung",
        model: "SM-A556E",
      },
      lastSuccessfulSyncAt: "2026-07-09T09:05:00.000Z",
    });

    expect(payload).toMatchObject({
      capturedAt: "2026-07-09T09:06:00.000Z",
      deviceId: "android-1",
      isLocationEnabled: true,
      foregroundPermission: "granted",
      backgroundPermission: "granted",
      notificationPermission: "granted",
      networkType: "cellular",
      isConnected: true,
      queuedPointCount: 3,
      lastLocationAt: "2026-07-09T09:03:00.000Z",
      lastSuccessfulSyncAt: "2026-07-09T09:05:00.000Z",
      appVersion: "1.4.0",
      androidVersion: "15",
      manufacturer: "Samsung",
      model: "SM-A556E",
    });
  });
});
