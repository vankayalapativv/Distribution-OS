import type { ExecutionContext } from "hono";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { authHeaders, authTestEnv, installAuthFetchMock } from "../test/auth";

const SE_ID = "00000000-0000-4000-8000-000000000004";
const OTHER_SE_ID = "00000000-0000-4000-8000-000000000009";

// Beat plan stop IDs
const STOP_ID = "00000000-0000-4000-8000-000000000701";           // pending
const CHECKED_IN_STOP_ID = "00000000-0000-4000-8000-000000000702"; // already checked_in
const COMPLETED_STOP_ID = "00000000-0000-4000-8000-000000000703";  // already completed
const OTHER_USER_STOP_ID = "00000000-0000-4000-8000-000000000704"; // belongs to OTHER_SE

const BEAT_PLAN_ID = "00000000-0000-4000-8000-000000000601";
const CUSTOMER_ID = "00000000-0000-4000-8000-000000000501";

// Visit IDs
const VISIT_ID = "00000000-0000-4000-8000-000000000801";           // active, linked to stop
const UNLINKED_VISIT_ID = "00000000-0000-4000-8000-000000000802"; // active, no linked stop (+ Date checkInTime)
const DONE_VISIT_ID = "00000000-0000-4000-8000-000000000803";     // already checked out
const OTHER_USER_VISIT_ID = "00000000-0000-4000-8000-000000000804"; // belongs to OTHER_SE
const NULL_EXEC_VISIT_ID = "00000000-0000-4000-8000-000000000805"; // executiveId=null → str() fallback
const FAR_VISIT_ID = "00000000-0000-4000-8000-000000000806";       // customer loc far from the checkout fix → OUT_OF_RANGE
const NO_OUTCOME_VISIT_ID = "00000000-0000-4000-8000-000000000807"; // no order/collection that day → NO_OUTCOME_REASON
const NO_OUTCOME_CUST = "00000000-0000-4000-8000-000000000502";

// Stop with Date executiveId → str() instanceof Date branch
const DATE_EXEC_STOP_ID = "00000000-0000-4000-8000-000000000705";

const GPS_SESSION_ID = "00000000-0000-4000-8000-000000000901";

// Mutable flag: lets individual tests control the GPS session existence branch
let mockGpsSessionExists = false;

// When set, simulate a concurrent duplicate check-in: the INSERT hits the partial
// unique index (on conflict do nothing → 0 rows) and the post-conflict re-select
// returns this row. Counter distinguishes the pre-insert guard SELECT (1st, empty)
// from the re-select (2nd, this row).
let mockCheckinRaceExisting: Record<string, unknown> | null = null;
let getVisitByClientUuidCalls = 0;

// Hono's `c.executionCtx` throws when app.request is called without one, and a
// fresh check-in uses `c.executionCtx.waitUntil` (office web-push + admin notify).
// Provide a no-op ExecutionContext so those paths run (and the tests exercise
// them) instead of 500-ing on a missing context.
const execCtx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

vi.mock("@neondatabase/serverless", () => ({
  neon: () => async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join(" ");

    // ── Auth ──────────────────────────────────────────────────────────────
    if (query.includes("auth_app_profile")) {
      const roleBySubject: Record<string, string> = {
        "neon-se": "SALES_EXECUTIVE",
        "neon-other-se": "SALES_EXECUTIVE",
        "neon-manager": "MANAGER",
      };
      const userIdBySubject: Record<string, string> = {
        "neon-se": SE_ID,
        "neon-other-se": OTHER_SE_ID,
        "neon-manager": "00000000-0000-4000-8000-000000000002",
      };
      const subject = values[0] as string;
      return [
        {
          role: roleBySubject[subject],
          userId: userIdBySubject[subject] ?? SE_ID, enterpriseId: "00000000-0000-4000-8000-0000000000e1",
        },
      ];
    }

    // ── Check-in: fetch stop ─────────────────────────────────────────────
    if (query.includes("get_beat_plan_stop_for_checkin")) {
      if (values.includes(STOP_ID)) {
        return [
          {
            id: STOP_ID,
            stopStatus: "pending",
            customerId: CUSTOMER_ID,
            beatPlanId: BEAT_PLAN_ID,
            executiveId: SE_ID,
          },
        ];
      }
      if (values.includes(CHECKED_IN_STOP_ID)) {
        return [
          {
            id: CHECKED_IN_STOP_ID,
            stopStatus: "checked_in",
            customerId: CUSTOMER_ID,
            beatPlanId: BEAT_PLAN_ID,
            executiveId: SE_ID,
          },
        ];
      }
      if (values.includes(COMPLETED_STOP_ID)) {
        return [
          {
            id: COMPLETED_STOP_ID,
            stopStatus: "completed",
            customerId: CUSTOMER_ID,
            beatPlanId: BEAT_PLAN_ID,
            executiveId: SE_ID,
          },
        ];
      }
      if (values.includes(OTHER_USER_STOP_ID)) {
        return [
          {
            id: OTHER_USER_STOP_ID,
            stopStatus: "pending",
            customerId: CUSTOMER_ID,
            beatPlanId: BEAT_PLAN_ID,
            executiveId: OTHER_SE_ID,
          },
        ];
      }
      if (values.includes(DATE_EXEC_STOP_ID)) {
        // Date object for executiveId: exercises str() instanceof Date branch (visits service line 8)
        return [
          {
            id: DATE_EXEC_STOP_ID,
            stopStatus: "pending",
            customerId: CUSTOMER_ID,
            beatPlanId: BEAT_PLAN_ID,
            executiveId: new Date("2026-07-08T00:00:00.000Z"),
          },
        ];
      }
      return [];
    }

    // ── Check-in: idempotency guard / post-conflict re-select ─────────────
    if (query.includes("get_visit_by_client_uuid")) {
      getVisitByClientUuidCalls += 1;
      // Race sim: guard (1st) finds nothing; re-select after the insert conflict
      // (2nd) returns the winner's row.
      if (mockCheckinRaceExisting && getVisitByClientUuidCalls >= 2) {
        return [mockCheckinRaceExisting];
      }
      return [];
    }

    // ── Check-in: create visit ────────────────────────────────────────────
    if (query.includes("create_visit")) {
      // Simulated concurrent duplicate → `on conflict do nothing` returns no row.
      if (mockCheckinRaceExisting) return [];
      return [
        {
          id: VISIT_ID,
          visitCode: "VIS-20260708-ABCDE",
          checkInTime: "2026-07-08T10:00:00.000Z",
        },
      ];
    }

    // ── Check-in: update stop ─────────────────────────────────────────────
    if (query.includes("update_stop_on_checkin")) {
      return [];
    }

    // ── Check-out: fetch visit ────────────────────────────────────────────
    if (query.includes("get_visit_for_checkout")) {
      if (values.includes(VISIT_ID)) {
        return [
          {
            id: VISIT_ID,
            executiveId: SE_ID,
            checkInTime: "2026-07-08T10:00:00.000Z",
            checkOutTime: null,
            stopId: STOP_ID,
          },
        ];
      }
      if (values.includes(UNLINKED_VISIT_ID)) {
        return [
          {
            id: UNLINKED_VISIT_ID,
            executiveId: SE_ID,
            // Date object for checkInTime: exercises `visit.checkInTime instanceof Date` branch in checkOut
            checkInTime: new Date("2026-07-08T10:00:00.000Z"),
            checkOutTime: null,
            stopId: null,
          },
        ];
      }
      if (values.includes(NULL_EXEC_VISIT_ID)) {
        // null executiveId: str(null) returns "" → exercises str() fallback (visits service line 9)
        return [
          {
            id: NULL_EXEC_VISIT_ID,
            executiveId: null,
            checkInTime: "2026-07-08T10:00:00.000Z",
            checkOutTime: null,
            stopId: null,
          },
        ];
      }
      if (values.includes(DONE_VISIT_ID)) {
        return [
          {
            id: DONE_VISIT_ID,
            executiveId: SE_ID,
            checkInTime: "2026-07-08T10:00:00.000Z",
            checkOutTime: "2026-07-08T11:00:00.000Z",
            stopId: null,
          },
        ];
      }
      if (values.includes(OTHER_USER_VISIT_ID)) {
        return [
          {
            id: OTHER_USER_VISIT_ID,
            executiveId: OTHER_SE_ID,
            checkInTime: "2026-07-08T10:00:00.000Z",
            checkOutTime: null,
            stopId: null,
          },
        ];
      }
      if (values.includes(FAR_VISIT_ID)) {
        // Customer saved at (0,0), far from any realistic checkout fix → geofence fails.
        return [
          {
            id: FAR_VISIT_ID, executiveId: SE_ID, customerId: CUSTOMER_ID, visitDate: "2026-07-08",
            checkInTime: "2026-07-08T10:00:00.000Z", checkOutTime: null, noOutcomeReason: null,
            custLat: 0, custLng: 0, stopId: null,
          },
        ];
      }
      if (values.includes(NO_OUTCOME_VISIT_ID)) {
        // No saved customer location (geofence skipped) + no order/collection that day.
        return [
          {
            id: NO_OUTCOME_VISIT_ID, executiveId: SE_ID, customerId: NO_OUTCOME_CUST, visitDate: "2026-07-08",
            checkInTime: "2026-07-08T10:00:00.000Z", checkOutTime: null, noOutcomeReason: null,
            custLat: null, custLng: null, stopId: null,
          },
        ];
      }
      return [];
    }

    // ── Check-out: no-outcome gate (false only for NO_OUTCOME_CUST) ───────
    if (query.includes("checkout_outcome_exists")) {
      return [{ hasOutcome: !values.includes(NO_OUTCOME_CUST) }];
    }

    // ── Check-out: update visit ───────────────────────────────────────────
    if (query.includes("update_visit_on_checkout")) {
      return [];
    }

    // ── Check-out: update stop ────────────────────────────────────────────
    if (query.includes("update_stop_on_checkout")) {
      return [];
    }

    // ── GPS: get today's session ──────────────────────────────────────────
    if (query.includes("get_gps_session_today")) {
      return mockGpsSessionExists ? [{ id: GPS_SESSION_ID }] : [];
    }

    // ── GPS: create session ───────────────────────────────────────────────
    if (query.includes("create_gps_session")) {
      return [{ id: GPS_SESSION_ID }];
    }

    // ── GPS: batched insert (unnest) — returns one id per inserted point ─────
    if (query.includes("insert_gps_points_batch")) {
      lastGpsInsertQuery = query;
      const arr = values.find((v) => Array.isArray(v)) as unknown[] | undefined;
      return Array.from({ length: arr?.length ?? 0 }, (_, i) => ({ id: `gp-${i}` }));
    }
    // ── GPS: insert point (legacy single-row path) ──────────────────────────
    if (query.includes("insert_gps_point")) {
      lastGpsInsertQuery = query;
      return [];
    }

    // ── GPS: end session ──────────────────────────────────────────────────
    if (query.includes("end_gps_session")) {
      return mockGpsSessionExists
        ? [{ id: GPS_SESSION_ID, endedAt: "2026-07-17T13:00:00.000Z" }]
        : [];
    }

    return [];
  },
}));

let lastGpsInsertQuery = "";

const env = {
  DATABASE_URL: "postgresql://example.test/db",
  ...authTestEnv,
};

function headers(subject: string) {
  return {
    "Content-Type": "application/json",
    ...authHeaders(subject),
  };
}

describe("visits routes", () => {
  beforeEach(() => {
    // GPS points recorded at/after 19:00 IST are dropped for SEs — pin the
    // clock to mid-day IST so defaulted timestamps stay inside the day.
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-07-20T06:30:00Z") });
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(installAuthFetchMock()),
    );
    mockGpsSessionExists = false;
    mockCheckinRaceExisting = null;
    getVisitByClientUuidCalls = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ────────────────────────────────────────────────────────────────────────────
  describe("POST /visits/checkin", () => {
    test("SE checks in at a pending stop → 201 with visitId, visitCode, checkInTime", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/visits/checkin",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({
            beatPlanStopId: STOP_ID,
            latitude: 13.0827,
            longitude: 80.2707,
            accuracy: 10,
          }),
        },
        env,
        execCtx,
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.visitId).toBe(VISIT_ID);
      expect(body.data.visitCode).toMatch(/^VIS-\d{8}-[A-Z0-9]{5}$/);
      expect(typeof body.data.checkInTime).toBe("string");
    });

    test("concurrent duplicate check-in (insert hits unique index) → 200 existing, not a 500", async () => {
      // Reproduces the production bug: two near-simultaneous check-ins with the
      // same deterministic clientUuid. The loser's INSERT conflicts on the partial
      // unique index; the fix returns the winner's row idempotently instead of a
      // duplicate-key 500.
      mockCheckinRaceExisting = {
        id: VISIT_ID,
        visitCode: "VIS-20260708-ABCDE",
        checkInTime: "2026-07-08T10:00:00.000Z",
      };

      const { default: app } = await import("../index");
      const res = await app.request(
        "/api/v1/visits/checkin",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({
            beatPlanStopId: STOP_ID,
            latitude: 13.0827,
            longitude: 80.2707,
            accuracy: 10,
            clientUuid: "11111111-1111-4111-8111-111111111111",
          }),
        },
        env,
        execCtx,
      );

      expect(res.status).toBe(200); // existing → 200, not 201 and not 500
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.existing).toBe(true);
      expect(body.data.visitId).toBe(VISIT_ID);
    });

    test("Returns 401 when not authenticated", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/visits/checkin",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ beatPlanStopId: STOP_ID, latitude: 13.0, longitude: 80.0 }),
        },
        env,
        execCtx,
      );

      expect(res.status).toBe(401);
    });

    test("Returns 404 when stop does not exist", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/visits/checkin",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({
            beatPlanStopId: "00000000-0000-4000-8000-000000099999",
            latitude: 13.0,
            longitude: 80.0,
          }),
        },
        env,
        execCtx,
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });

    test("Returns 403 when stop belongs to a different SE", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/visits/checkin",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({
            beatPlanStopId: OTHER_USER_STOP_ID,
            latitude: 13.0,
            longitude: 80.0,
          }),
        },
        env,
        execCtx,
      );

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe("FORBIDDEN");
    });

    test("Returns 409 when stop is already checked_in", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/visits/checkin",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({
            beatPlanStopId: CHECKED_IN_STOP_ID,
            latitude: 13.0,
            longitude: 80.0,
          }),
        },
        env,
        execCtx,
      );

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.code).toBe("CONFLICT");
    });

    test("Returns 409 when stop is already completed", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/visits/checkin",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({
            beatPlanStopId: COMPLETED_STOP_ID,
            latitude: 13.0,
            longitude: 80.0,
          }),
        },
        env,
        execCtx,
      );

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.code).toBe("CONFLICT");
    });

    test("Returns 422 when beatPlanStopId is missing", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/visits/checkin",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({ latitude: 13.0, longitude: 80.0 }),
        },
        env,
        execCtx,
      );

      expect(res.status).toBe(422);
    });

    test("Returns 422 when latitude is missing", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/visits/checkin",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({ beatPlanStopId: STOP_ID, longitude: 80.0 }),
        },
        env,
        execCtx,
      );

      expect(res.status).toBe(422);
    });

    test("Returns 403 when stop executiveId is a Date object (str() Date branch)", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/visits/checkin",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({
            beatPlanStopId: DATE_EXEC_STOP_ID,
            latitude: 13.0,
            longitude: 80.0,
          }),
        },
        env,
        execCtx,
      );

      // str(new Date(...)) returns ISO string which !== SE_ID → 403
      expect(res.status).toBe(403);
    });

    test("Returns 422 when longitude is missing", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/visits/checkin",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({ beatPlanStopId: STOP_ID, latitude: 13.0 }),
        },
        env,
        execCtx,
      );

      expect(res.status).toBe(422);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  describe("POST /visits/:id/checkout", () => {
    test("SE checks out from an active visit → 200 with visitId and durationMinutes", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/visits/${VISIT_ID}/checkout`,
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({ latitude: 13.0827, longitude: 80.2707 }),
        },
        env,
        execCtx,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.visitId).toBe(VISIT_ID);
      expect(typeof body.data.durationMinutes).toBe("number");
      expect(body.data.durationMinutes).toBeGreaterThanOrEqual(0);
    });

    test("Checkout with no linked stop (unlinked visit) still succeeds", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/visits/${UNLINKED_VISIT_ID}/checkout`,
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({ latitude: 13.0, longitude: 80.0 }),
        },
        env,
        execCtx,
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.visitId).toBe(UNLINKED_VISIT_ID);
    });

    test("Returns 403 when visit executiveId is null (str() fallback branch)", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/visits/${NULL_EXEC_VISIT_ID}/checkout`,
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({ latitude: 13.0, longitude: 80.0 }),
        },
        env,
        execCtx,
      );

      // str(null) returns "" which !== SE_ID → 403
      expect(res.status).toBe(403);
    });

    test("Returns 401 when not authenticated", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/visits/${VISIT_ID}/checkout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
        env,
        execCtx,
      );

      expect(res.status).toBe(401);
    });

    test("Returns 404 when visit does not exist", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/visits/00000000-0000-4000-8000-000000099999/checkout",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({ latitude: 13.0, longitude: 80.0 }),
        },
        env,
        execCtx,
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    test("Returns 403 when visit belongs to a different SE", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/visits/${OTHER_USER_VISIT_ID}/checkout`,
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({ latitude: 13.0, longitude: 80.0 }),
        },
        env,
        execCtx,
      );

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe("FORBIDDEN");
    });

    test("Returns 409 when visit is already checked out", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        `/api/v1/visits/${DONE_VISIT_ID}/checkout`,
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({ latitude: 13.0, longitude: 80.0 }),
        },
        env,
        execCtx,
      );

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.code).toBe("CONFLICT");
    });

    test("Returns 422 OUT_OF_RANGE when the checkout fix is outside the 100 m geofence", async () => {
      const { default: app } = await import("../index");
      const res = await app.request(
        `/api/v1/visits/${FAR_VISIT_ID}/checkout`,
        { method: "POST", headers: headers("neon-se"), body: JSON.stringify({ latitude: 13.0827, longitude: 80.2707, accuracy: 10 }) },
        env, execCtx,
      );
      expect(res.status).toBe(422);
      expect((await res.json()).error.code).toBe("OUT_OF_RANGE");
    });

    test("Returns 422 NO_OUTCOME_REASON without a reason, then 200 once a reason is supplied", async () => {
      const { default: app } = await import("../index");
      const noReason = await app.request(
        `/api/v1/visits/${NO_OUTCOME_VISIT_ID}/checkout`,
        { method: "POST", headers: headers("neon-se"), body: JSON.stringify({ latitude: 13.0, longitude: 80.0 }) },
        env, execCtx,
      );
      expect(noReason.status).toBe(422);
      expect((await noReason.json()).error.code).toBe("NO_OUTCOME_REASON");

      const withReason = await app.request(
        `/api/v1/visits/${NO_OUTCOME_VISIT_ID}/checkout`,
        { method: "POST", headers: headers("neon-se"), body: JSON.stringify({ latitude: 13.0, longitude: 80.0, reason: "Shop closed" }) },
        env, execCtx,
      );
      expect(withReason.status).toBe(200);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  describe("POST /visits/gps", () => {
    const samplePoint = {
      latitude: 13.0827,
      longitude: 80.2707,
      accuracy: 8.5,
      batteryPercentage: 72,
      recordedAt: "2026-07-08T10:15:00.000Z",
    };

    test("Uploads GPS pings and creates a new session → 201 with inserted count and sessionId", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/visits/gps",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({ points: [samplePoint, { ...samplePoint, latitude: 13.09 }] }),
        },
        env,
        execCtx,
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.inserted).toBe(2);
      expect(body.data.sessionId).toBe(GPS_SESSION_ID);
    });

    test("Point insert is retry-safe (on conflict do nothing on user+timestamp)", async () => {
      const { default: app } = await import("../index");
      await app.request(
        "/api/v1/visits/gps",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({ points: [samplePoint] }),
        },
        env,
        execCtx,
      );
      expect(lastGpsInsertQuery).toContain("on conflict (user_id, recorded_at) do nothing");
    });

    test("POST /visits/gps/end closes today's active session", async () => {
      mockGpsSessionExists = true;
      const { default: app } = await import("../index");
      const res = await app.request(
        "/api/v1/visits/gps/end",
        { method: "POST", headers: headers("neon-se"), body: "{}" },
        env,
        execCtx,
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.ended).toBe(true);
      expect(body.data.endedAt).toBeTruthy();
    });

    test("POST /visits/gps/end with no active session is a harmless no-op", async () => {
      const { default: app } = await import("../index");
      const res = await app.request(
        "/api/v1/visits/gps/end",
        { method: "POST", headers: headers("neon-se"), body: "{}" },
        env,
        execCtx,
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.ended).toBe(false);
    });

    test("Reuses an existing GPS session when one already exists today", async () => {
      mockGpsSessionExists = true;
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/visits/gps",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({ points: [samplePoint] }),
        },
        env,
        execCtx,
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.sessionId).toBe(GPS_SESSION_ID);
      expect(body.data.inserted).toBe(1);
    });

    test("Empty points array returns 201 with inserted=0 and sessionId=null", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/visits/gps",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({ points: [] }),
        },
        env,
        execCtx,
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.inserted).toBe(0);
      expect(body.data.sessionId).toBeNull();
    });

    test("Returns 401 when not authenticated", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/visits/gps",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ points: [samplePoint] }),
        },
        env,
        execCtx,
      );

      expect(res.status).toBe(401);
    });

    test("Returns 422 when points is not an array", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/visits/gps",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({ points: "not-an-array" }),
        },
        env,
        execCtx,
      );

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error.code).toBe("INVALID_FIELD");
    });

    test("Returns 422 when a point is missing numeric lat/lng", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/visits/gps",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({
            points: [{ latitude: "bad", longitude: 80.0, recordedAt: "2026-07-08T10:00:00Z" }],
          }),
        },
        env,
        execCtx,
      );

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error.code).toBe("INVALID_FIELD");
    });

    test("Returns 422 when a point is not an object", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/visits/gps",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({ points: [42] }),
        },
        env,
        execCtx,
      );

      expect(res.status).toBe(422);
    });

    test("GPS point without optional fields still succeeds (accuracy/battery default to null)", async () => {
      const { default: app } = await import("../index");

      const res = await app.request(
        "/api/v1/visits/gps",
        {
          method: "POST",
          headers: headers("neon-se"),
          body: JSON.stringify({
            points: [{ latitude: 13.0827, longitude: 80.2707 }],
          }),
        },
        env,
        execCtx,
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.inserted).toBe(1);
    });
  });
});
