import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { authHeaders, authTestEnv, installAuthFetchMock } from "../test/auth";

const SE_ID = "00000000-0000-4000-8000-000000000004";
const MANAGER_ID = "00000000-0000-4000-8000-000000000002";
const SESSION_ID = "00000000-0000-4000-8000-000000000901";
const CLIENT_SESSION_ID = "10000000-0000-4000-8000-000000000901";
const DEVICE_ID = "device-moto-g84";
const POINT_ID = "20000000-0000-4000-8000-000000000001";
const AFTER_CLOSE_POINT_ID = "20000000-0000-4000-8000-000000000002";
const TIMESTAMP_COLLISION_POINT_ID = "20000000-0000-4000-8000-000000000003";

let activeSession: Record<string, unknown> | null = null;
let sessionsByClientId = new Map<string, Record<string, unknown>>();
let lastCreateSessionQuery = "";
let insertedPointIds = new Set<string>();
let lastInsertPointQuery = "";
let lastHeartbeatQuery = "";
let lastHeartbeatValues: unknown[] = [];
let distanceQueryTags: string[] = [];

vi.mock("@neondatabase/serverless", () => {
  const mockSql = Object.assign(
    async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join(" ");
    const tag = query.match(/\/\*\s*([^*]+?)\s*\*\//)?.[1]?.trim();
    if (tag?.includes("tracking") || tag?.includes("distance")) distanceQueryTags.push(tag);

    if (query.includes("auth_app_profile")) {
      const subject = values[0] as string;
      return [
        {
          role: subject === "neon-manager" ? "MANAGER" : "SALES_EXECUTIVE",
          userId: subject === "neon-manager" ? MANAGER_ID : SE_ID,
        },
      ];
    }

    if (query.includes("get_active_tracking_session")) {
      return activeSession ? [activeSession] : [];
    }

    if (query.includes("get_tracking_session_by_client_session_id")) {
      const clientSessionId = values[0] as string;
      const found = sessionsByClientId.get(clientSessionId);
      return found ? [found] : [];
    }

    if (query.includes("create_tracking_session")) {
      lastCreateSessionQuery = query;
      activeSession = {
        id: SESSION_ID,
        clientSessionId: values[1] as string,
        userId: SE_ID,
        deviceId: DEVICE_ID,
        sessionDate: "2026-07-20",
        startedAt: "2026-07-20T09:00:00.000Z",
        endedAt: null,
        status: "active",
      };
      sessionsByClientId.set(values[1] as string, activeSession);
      return [activeSession];
    }

    if (query.includes("end_tracking_session")) {
      if (!activeSession || activeSession.status !== "active") return [];
      activeSession = {
        ...activeSession,
        endedAt: "2026-07-20T13:00:00.000Z",
        status: "ended",
      };
      return [activeSession];
    }

    if (query.includes("get_tracking_session_by_id")) {
      return activeSession && values.includes(SESSION_ID) ? [activeSession] : [];
    }

    if (query.includes("get_tracking_session_for_points")) {
      return activeSession && values.includes(SESSION_ID)
        ? [{
            id: SESSION_ID,
            userId: SE_ID,
            sessionDate: activeSession.sessionDate,
            timezone: activeSession.timezone ?? "Asia/Kolkata",
            status: activeSession.status,
          }]
        : [];
    }

    if (query.includes("get_tracking_session_for_heartbeat")) {
      return activeSession && values.includes(SESSION_ID)
        ? [{ id: SESSION_ID, userId: SE_ID, organizationId: "00000000-0000-4000-8000-000000000099" }]
        : [];
    }

    if (query.includes("insert_tracking_heartbeat")) {
      lastHeartbeatQuery = query;
      lastHeartbeatValues = values;
      return [{ heartbeatId: "30000000-0000-4000-8000-000000000001" }];
    }

    if (query.includes("insert_tracking_point")) {
      lastInsertPointQuery = query;
      // `on conflict do nothing` skips the (user_id, recorded_at) dedup silently
      // (no throw), returning no row → the point reads as a "duplicate".
      if (values.includes(TIMESTAMP_COLLISION_POINT_ID)) {
        return [];
      }
      const pointId = values.find((v) => v === POINT_ID) as string | undefined;
      if (pointId && insertedPointIds.has(pointId)) return [];
      if (pointId) insertedPointIds.add(pointId);
      return pointId ? [{ locationPointId: pointId }] : [];
    }

    if (query.includes("select_tracking_points_for_distance")) {
      return [
        {
          pointId: POINT_ID,
          latitude: 17.249,
          longitude: 80.153,
          accuracyMeters: 8,
          recordedAt: "2026-07-20T09:03:00.000Z",
        },
      ];
    }

    if (query.includes("select_tracking_session_for_dwell")) {
      return [{ sessionId: SESSION_ID, organizationId: "00000000-0000-4000-8000-000000000099", userId: SE_ID }];
    }

    if (query.includes("select_customers_for_dwell")) {
      return [{ customerId: "00000000-0000-4000-8000-000000000501", customerName: "Sri Auto Oils", latitude: 17.249, longitude: 80.153 }];
    }

    if (query.includes("select_tracking_points_for_dwell")) {
      return [
        { pointId: "30000000-0000-4000-8000-000000000001", latitude: 17.249, longitude: 80.153, accuracyMeters: 8, recordedAt: "2026-07-20T09:00:00.000Z" },
        { pointId: "30000000-0000-4000-8000-000000000002", latitude: 17.24901, longitude: 80.15301, accuracyMeters: 8, recordedAt: "2026-07-20T09:03:00.000Z" },
        { pointId: "30000000-0000-4000-8000-000000000003", latitude: 17.24902, longitude: 80.15302, accuracyMeters: 8, recordedAt: "2026-07-20T09:06:00.000Z" },
      ];
    }

    return [];
    },
    { transaction: (queries: Promise<unknown>[]) => Promise.all(queries) },
  );
  return { neon: () => mockSql };
});

const env = {
  DATABASE_URL: "postgresql://example.test/db",
  ...authTestEnv,
};

function headers(subject = "neon-se") {
  return {
    "Content-Type": "application/json",
    ...authHeaders(subject),
  };
}

describe("tracking session routes", () => {
  beforeEach(() => {
    // The SE day ends at 19:00 IST (session start rejected after) — pin the
    // clock to mid-day IST so these tests pass regardless of when they run.
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-07-20T06:30:00Z") });
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(installAuthFetchMock()),
    );
    activeSession = null;
    sessionsByClientId = new Map();
    lastCreateSessionQuery = "";
    insertedPointIds = new Set();
    lastInsertPointQuery = "";
    lastHeartbeatQuery = "";
    lastHeartbeatValues = [];
    distanceQueryTags = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("Start Day creates a tracking session and returns trackingSessionId", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      "/api/v1/tracking-sessions/start",
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ clientSessionId: CLIENT_SESSION_ID, deviceId: DEVICE_ID }),
      },
      env,
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.trackingSessionId).toBe(SESSION_ID);
    expect(body.data.clientSessionId).toBe(CLIENT_SESSION_ID);
    expect(body.data.status).toBe("active");
  });

  test("GET active returns the user's active tracking session", async () => {
    const { default: app } = await import("../index");
    await app.request(
      "/api/v1/tracking-sessions/start",
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ clientSessionId: CLIENT_SESSION_ID, deviceId: DEVICE_ID }),
      },
      env,
    );

    const res = await app.request(
      "/api/v1/tracking-sessions/active",
      { headers: headers() },
      env,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.activeSession.trackingSessionId).toBe(SESSION_ID);
  });

  test("duplicate Start Day reuses the existing active session", async () => {
    const { default: app } = await import("../index");

    await app.request(
      "/api/v1/tracking-sessions/start",
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ clientSessionId: CLIENT_SESSION_ID, deviceId: DEVICE_ID }),
      },
      env,
    );
    const res = await app.request(
      "/api/v1/tracking-sessions/start",
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ clientSessionId: "10000000-0000-4000-8000-000000000902", deviceId: DEVICE_ID }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.trackingSessionId).toBe(SESSION_ID);
  });

  test("replayed Start Day with the same clientSessionId returns the existing session (200), never a duplicate-key 500", async () => {
    const { default: app } = await import("../index");

    const first = await app.request(
      "/api/v1/tracking-sessions/start",
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ clientSessionId: CLIENT_SESSION_ID, deviceId: DEVICE_ID }),
      },
      env,
    );
    expect(first.status).toBe(201);
    // The insert is now idempotent on the deterministic client_session_id.
    expect(lastCreateSessionQuery).toContain("on conflict");

    // Simulate the active-session lookup missing the row (it ended, or a
    // concurrent racer beat this request) while the deterministic
    // clientSessionId still resolves to its session. The replay must return
    // that session rather than blow up on gps_tracking_sessions_client_session_id_key.
    activeSession = null;

    const replay = await app.request(
      "/api/v1/tracking-sessions/start",
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ clientSessionId: CLIENT_SESSION_ID, deviceId: DEVICE_ID }),
      },
      env,
    );

    expect(replay.status).toBe(200);
    const body = await replay.json();
    expect(body.data.trackingSessionId).toBe(SESSION_ID);
    expect(body.data.clientSessionId).toBe(CLIENT_SESSION_ID);
  });

  test("End Day closes the active tracking session idempotently", async () => {
    const { default: app } = await import("../index");
    await app.request(
      "/api/v1/tracking-sessions/start",
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ clientSessionId: CLIENT_SESSION_ID, deviceId: DEVICE_ID }),
      },
      env,
    );

    const first = await app.request(
      `/api/v1/tracking-sessions/${SESSION_ID}/end`,
      { method: "POST", headers: headers(), body: "{}" },
      env,
    );
    const second = await app.request(
      `/api/v1/tracking-sessions/${SESSION_ID}/end`,
      { method: "POST", headers: headers(), body: "{}" },
      env,
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((await first.json()).data.status).toBe("ended");
    expect((await second.json()).data.status).toBe("ended");
    expect(distanceQueryTags).toContain("update_tracking_session_distance_summary");
    expect(distanceQueryTags).toContain("insert_tracking_session_dwell_bulk");
  });

  test("points batch returns per-point acknowledgement statuses", async () => {
    const { default: app } = await import("../index");
    await app.request(
      "/api/v1/tracking-sessions/start",
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ clientSessionId: CLIENT_SESSION_ID, deviceId: DEVICE_ID }),
      },
      env,
    );

    const first = await app.request(
      `/api/v1/tracking-sessions/${SESSION_ID}/points/batch`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          points: [
            {
              locationPointId: POINT_ID,
              latitude: 17.249,
              longitude: 80.153,
              accuracy: 8,
              recordedAt: "2026-07-20T09:03:00.000Z",
            },
          ],
        }),
      },
      env,
    );
    const duplicate = await app.request(
      `/api/v1/tracking-sessions/${SESSION_ID}/points/batch`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          points: [
            {
              locationPointId: POINT_ID,
              latitude: 17.249,
              longitude: 80.153,
              recordedAt: "2026-07-20T09:03:00.000Z",
            },
          ],
        }),
      },
      env,
    );

    expect(first.status).toBe(201);
    expect(duplicate.status).toBe(201);
    expect((await first.json()).data.results).toEqual([
      { locationPointId: POINT_ID, status: "accepted" },
    ]);
    expect((await duplicate.json()).data.results).toEqual([
      { locationPointId: POINT_ID, status: "duplicate" },
    ]);
    expect(lastInsertPointQuery).toContain("on conflict");
    expect(distanceQueryTags).toContain("update_tracking_session_distance_summary");
    expect(distanceQueryTags).toContain("insert_tracking_session_dwell_bulk");
  });

  test("same-timestamp native and Expo fixes are acknowledged as duplicates", async () => {
    const { default: app } = await import("../index");
    await app.request(
      "/api/v1/tracking-sessions/start",
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ clientSessionId: CLIENT_SESSION_ID, deviceId: DEVICE_ID }),
      },
      env,
    );

    const res = await app.request(
      `/api/v1/tracking-sessions/${SESSION_ID}/points/batch`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          points: [{
            locationPointId: TIMESTAMP_COLLISION_POINT_ID,
            latitude: 17.249,
            longitude: 80.153,
            accuracy: 10,
            recordedAt: "2026-07-20T09:03:00.000Z",
          }],
        }),
      },
      env,
    );

    expect(res.status).toBe(201);
    expect((await res.json()).data.results).toEqual([
      { locationPointId: TIMESTAMP_COLLISION_POINT_ID, status: "duplicate" },
    ]);
  });

  test("points within the IST day are accepted; points spilling into the next IST day are rejected", async () => {
    const { default: app } = await import("../index");
    await app.request(
      "/api/v1/tracking-sessions/start",
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ clientSessionId: CLIENT_SESSION_ID, deviceId: DEVICE_ID }),
      },
      env,
    );
    activeSession = { ...activeSession, status: "ended", sessionDate: "2026-07-20", timezone: "Asia/Kolkata" };

    const res = await app.request(
      `/api/v1/tracking-sessions/${SESSION_ID}/points/batch`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          points: [
            {
              // 23:55 IST on the session day — late evening, now kept (no 8 PM cutoff)
              locationPointId: POINT_ID,
              latitude: 17.249,
              longitude: 80.153,
              recordedAt: "2026-07-20T18:25:00.000Z",
            },
            {
              // 00:05 IST the NEXT day — spilled past the session's IST day → dropped
              locationPointId: AFTER_CLOSE_POINT_ID,
              latitude: 17.25,
              longitude: 80.154,
              recordedAt: "2026-07-20T18:35:00.000Z",
            },
          ],
        }),
      },
      env,
    );

    expect(res.status).toBe(201);
    expect((await res.json()).data.results).toEqual([
      { locationPointId: POINT_ID, status: "accepted" },
      {
        locationPointId: AFTER_CLOSE_POINT_ID,
        status: "rejected",
        reason: "AFTER_ALLOWED_END_TIME",
      },
    ]);
  });

  test("heartbeat stores device health for the active session", async () => {
    const { default: app } = await import("../index");
    await app.request(
      "/api/v1/tracking-sessions/start",
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ clientSessionId: CLIENT_SESSION_ID, deviceId: DEVICE_ID }),
      },
      env,
    );

    const res = await app.request(
      `/api/v1/tracking-sessions/${SESSION_ID}/heartbeat`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          deviceId: DEVICE_ID,
          capturedAt: "2026-07-20T10:15:00.000Z",
          batteryPercentage: 62,
          isCharging: false,
          isLowPowerModeEnabled: false,
          isLocationEnabled: true,
          foregroundPermission: "granted",
          backgroundPermission: "granted",
          notificationPermission: "granted",
          batteryOptimizationStatus: "unrestricted",
          networkType: "cellular",
          isConnected: true,
          queuedPointCount: 4,
          lastLocationAt: "2026-07-20T10:12:04.000Z",
          lastSuccessfulSyncAt: "2026-07-20T10:12:15.000Z",
          appVersion: "1.4.0",
          androidVersion: "15",
          manufacturer: "Samsung",
          model: "SM-A556E",
        }),
      },
      env,
    );

    expect(res.status).toBe(201);
    expect((await res.json()).data.heartbeatId).toBe("30000000-0000-4000-8000-000000000001");
    expect(lastHeartbeatQuery).toContain("tracking_device_heartbeats");
    expect(lastHeartbeatValues).toContain(SESSION_ID);
    expect(lastHeartbeatValues).toContain(62);
    expect(lastHeartbeatValues).toContain(4);
  });

  test("heartbeat rejects impossible battery percentages", async () => {
    const { default: app } = await import("../index");
    await app.request(
      "/api/v1/tracking-sessions/start",
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ clientSessionId: CLIENT_SESSION_ID, deviceId: DEVICE_ID }),
      },
      env,
    );

    const res = await app.request(
      `/api/v1/tracking-sessions/${SESSION_ID}/heartbeat`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          capturedAt: "2026-07-20T10:15:00.000Z",
          batteryPercentage: 150,
          queuedPointCount: 0,
        }),
      },
      env,
    );

    expect(res.status).toBe(422);
    expect(lastHeartbeatQuery).toBe("");
  });
});
