import { beforeEach, describe, expect, test, vi } from "vitest";
import { authHeaders, authTestEnv, installAuthFetchMock } from "../test/auth";

const SUPER_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const MANAGER_ID = "00000000-0000-4000-8000-000000000002";
const ACCOUNTANT_ID = "00000000-0000-4000-8000-000000000003";
const SE_ID = "00000000-0000-4000-8000-000000000004";

const queryLog: string[] = [];
const queryText: Record<string, string> = {};
let lastValues: unknown[] = [];
let trackingExecutiveRows: Record<string, unknown>[] = [];

vi.mock("@neondatabase/serverless", () => ({
  neon: () => async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join(" ");
    const tag = query.match(/\/\*\s*([a-z0-9_]+)\s*\*\//i);
    if (tag) {
      queryLog.push(tag[1]);
      queryText[tag[1]] = query;
    }

    if (query.includes("auth_app_profile")) {
      const map: Record<string, { role: string; userId: string }> = {
        "neon-super-admin": { role: "SUPER_ADMIN", userId: SUPER_ADMIN_ID },
        "neon-manager": { role: "MANAGER", userId: MANAGER_ID },
        "neon-accountant": { role: "ACCOUNTANT", userId: ACCOUNTANT_ID },
        "neon-se": { role: "SALES_EXECUTIVE", userId: SE_ID },
      };
      return [map[values[0] as string] ?? map["neon-super-admin"]];
    }

    if (query.includes("tracking_executives")) {
      lastValues = values;
      return trackingExecutiveRows;
    }
    if (query.includes("tracking_route")) {
      lastValues = values;
      return [
        {
          latitude: "17.2480000",
          longitude: "80.1520000",
          accuracyMeters: "10.00",
          recordedAt: "2026-07-11T09:00:00.000Z",
        },
        {
          latitude: "17.2490000",
          longitude: "80.1530000",
          accuracyMeters: "8.20",
          recordedAt: "2026-07-11T09:05:00.000Z",
        },
      ];
    }
    return [];
  },
}));

const env = { DATABASE_URL: "postgresql://example.test/db", ...authTestEnv };

function headers(subject: string) {
  return { "Content-Type": "application/json", ...authHeaders(subject) };
}

describe("live GPS tracking (web view)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(installAuthFetchMock()));
    queryLog.length = 0;
    for (const key of Object.keys(queryText)) delete queryText[key];
    lastValues = [];
    trackingExecutiveRows = [
      {
        userId: SE_ID,
        name: "Test_sales",
        sessionStatus: "active",
        startedAt: "2026-07-11T09:00:00.000Z",
        endedAt: null,
        pointCount: 12,
        lastLatitude: "17.2490000",
        lastLongitude: "80.1530000",
        lastAccuracyMeters: "8.20",
        lastRecordedAt: "2026-07-11T10:00:00.000Z",
        lastHeartbeatAt: "2026-07-11T10:01:00.000Z",
        isLocationEnabled: true,
        foregroundPermission: "granted",
        backgroundPermission: "granted",
        totalDistanceKm: "42.60",
        distanceAlgorithmVersion: "filtered-haversine-v1",
        acceptedDistancePointCount: 218,
        rejectedDistancePointCount: 12,
      },
    ];
  });

  test("super admin and manager can list executives; accountant and SE cannot", async () => {
    const { default: app } = await import("../index");

    for (const subject of ["neon-super-admin", "neon-manager"]) {
      const res = await app.request(
        "/api/v1/tracking/executives?date=2026-07-11",
        { headers: headers(subject) },
        env,
      );
      expect(res.status).toBe(200);
    }
    for (const subject of ["neon-accountant", "neon-se"]) {
      const res = await app.request(
        "/api/v1/tracking/executives?date=2026-07-11",
        { headers: headers(subject) },
        env,
      );
      expect(res.status).toBe(403);
    }
  });

  test("executives list returns latest position summary per SE", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      "/api/v1/tracking/executives?date=2026-07-11",
      { headers: headers("neon-manager") },
      env,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(queryLog).toContain("tracking_executives");
    expect(lastValues).toContain("2026-07-11");
    expect(body.data.executives).toHaveLength(1);
    const ex = body.data.executives[0];
    expect(ex.userId).toBe(SE_ID);
    expect(ex.name).toBe("Test_sales");
    expect(ex.sessionStatus).toBe("active");
    expect(ex.pointCount).toBe(12);
    expect(ex.lastLatitude).toBeCloseTo(17.249);
    expect(ex.lastLongitude).toBeCloseTo(80.153);
    expect(ex.lastRecordedAt).toBe("2026-07-11T10:00:00.000Z");
    expect(ex.totalDistanceKm).toBeCloseTo(42.6);
    expect(ex.distanceAlgorithmVersion).toBe("filtered-haversine-v1");
    expect(ex.acceptedDistancePointCount).toBe(218);
    expect(ex.rejectedDistancePointCount).toBe(12);
  });

  test("executives list returns explicit dashboard freshness states", async () => {
    vi.setSystemTime(new Date("2026-07-11T10:10:00.000Z"));
    trackingExecutiveRows = [
      {
        userId: SE_ID,
        name: "Fresh SE",
        sessionStatus: "active",
        startedAt: "2026-07-11T09:00:00.000Z",
        endedAt: null,
        pointCount: 10,
        lastLatitude: "17.2490000",
        lastLongitude: "80.1530000",
        lastAccuracyMeters: "8.20",
        lastRecordedAt: "2026-07-11T10:07:00.000Z",
        lastHeartbeatAt: "2026-07-11T10:08:00.000Z",
        isLocationEnabled: true,
        foregroundPermission: "granted",
        backgroundPermission: "granted",
      },
      {
        userId: "00000000-0000-4000-8000-000000000005",
        name: "GPS Off SE",
        sessionStatus: "active",
        startedAt: "2026-07-11T09:00:00.000Z",
        endedAt: null,
        pointCount: 8,
        lastLatitude: "17.2500000",
        lastLongitude: "80.1540000",
        lastAccuracyMeters: "9.00",
        lastRecordedAt: "2026-07-11T10:01:00.000Z",
        lastHeartbeatAt: "2026-07-11T10:09:00.000Z",
        isLocationEnabled: false,
        foregroundPermission: "granted",
        backgroundPermission: "granted",
      },
      {
        userId: "00000000-0000-4000-8000-000000000006",
        name: "Ended SE",
        sessionStatus: "ended",
        startedAt: "2026-07-11T09:00:00.000Z",
        endedAt: "2026-07-11T10:00:00.000Z",
        pointCount: 6,
        lastLatitude: "17.2510000",
        lastLongitude: "80.1550000",
        lastAccuracyMeters: "11.00",
        lastRecordedAt: "2026-07-11T09:59:00.000Z",
        lastHeartbeatAt: "2026-07-11T09:59:00.000Z",
        isLocationEnabled: true,
        foregroundPermission: "granted",
        backgroundPermission: "granted",
      },
    ];
    const { default: app } = await import("../index");

    const res = await app.request(
      "/api/v1/tracking/executives?date=2026-07-11",
      { headers: headers("neon-manager") },
      env,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.executives.map((e: { trackingStatus: string }) => e.trackingStatus)).toEqual([
      "fresh",
      "gps_disabled",
      "day_ended",
    ]);
    expect(body.data.executives[0].trackingStatusLabel).toBe("Fresh");
    expect(body.data.executives[0].locationLabel).toBe("Latest known location");
  });

  test("executives list defaults to today when no date is passed", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      "/api/v1/tracking/executives",
      { headers: headers("neon-super-admin") },
      env,
    );

    expect(res.status).toBe(200);
    const bound = lastValues.find((v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v));
    expect(bound).toBeTruthy();
  });

  test("invalid date → 422", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      "/api/v1/tracking/executives?date=tomorrow",
      { headers: headers("neon-manager") },
      env,
    );

    expect(res.status).toBe(422);
  });

  test("route returns ordered points for one SE and day", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      `/api/v1/tracking/route?userId=${SE_ID}&date=2026-07-11`,
      { headers: headers("neon-manager") },
      env,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(queryLog).toContain("tracking_route");
    expect(lastValues).toContain(SE_ID);
    expect(body.data.points).toHaveLength(2);
    expect(body.data.points[0].latitude).toBeCloseTo(17.248);
    expect(body.data.points[1].recordedAt).toBe("2026-07-11T09:05:00.000Z");
  });

  test("map queries exclude low-accuracy fixes (accuracy_meters > 100)", async () => {
    const { default: app } = await import("../index");

    await app.request(
      "/api/v1/tracking/executives?date=2026-07-11",
      { headers: headers("neon-manager") },
      env,
    );
    await app.request(
      `/api/v1/tracking/route?userId=${SE_ID}&date=2026-07-11`,
      { headers: headers("neon-manager") },
      env,
    );

    for (const tag of ["tracking_executives", "tracking_route"]) {
      expect(queryText[tag]).toMatch(/accuracy_meters is null or accuracy_meters <=/);
    }
    expect(lastValues).toContain(100);
  });

  test("route without userId → 422", async () => {
    const { default: app } = await import("../index");

    const res = await app.request(
      "/api/v1/tracking/route?date=2026-07-11",
      { headers: headers("neon-manager") },
      env,
    );

    expect(res.status).toBe(422);
  });
});
