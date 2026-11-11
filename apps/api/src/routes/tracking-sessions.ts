import { Hono } from "hono";
import { z } from "zod";
import { success } from "../lib/api-response";
import { requireRole } from "../lib/authz";
import { getSqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";
import { validate } from "../lib/validate";
import { waitUntilSafe } from "../lib/wait-until";
import { notifyAdminsOfDayEvent } from "../services/admin-notify";
import {
  optionalBoolean,
  optionalNumber,
  optionalString,
  readJsonObject,
  requiredNumber,
  requiredString,
} from "../lib/request-body";
import {
  endTrackingSession,
  getActiveTrackingSession,
  insertTrackingPoints,
  recordExecutiveSignedOut,
  recordTrackingHeartbeat,
  startTrackingSession,
  type TrackingHeartbeatInput,
  type TrackingPointInput,
} from "../services/tracking-sessions";
import type { ApiEnv } from "../types";

const MOBILE_TRACKING_ROLES = ["SALES_EXECUTIVE", "LOGISTICS"] as const;

/** Odometer is a whole-km reading: a non-negative integer under 10,000,000.
 *  Null (not sent) is allowed — old app versions and auto-closed sessions. */
function assertOdometer(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isInteger(value) || value < 0 || value >= 10_000_000) {
    throw new ApiError("INVALID_FIELD", "Odometer must be a whole number of kilometres.", 422);
  }
  return value;
}

// Bounded numeric fields on a heartbeat (audit G-0602).
const HeartbeatNumbersSchema = z.object({
  batteryPercentage: z.number().min(0).max(100).nullish(),
  queuedPointCount: z.number().min(0).nullish(),
});

export const trackingSessionsRoutes = new Hono<ApiEnv>()
  .post("/start", async (c) => {
    const auth = requireRole(c, [...MOBILE_TRACKING_ROLES]);
    const body = await readJsonObject(c);
    const sql = getSqlClient(c);
    const result = await startTrackingSession(sql, {
      userId: auth.userId!,
      clientSessionId: requiredString(body, "clientSessionId"),
      deviceId: optionalString(body, "deviceId"),
      role: auth.role,
      startOdometer: assertOdometer(optionalNumber(body, "startOdometer")),
    });

    // A SALES_EXECUTIVE's FRESH Start day (not a re-tap / replay) → let the Super
    // Admins know on their mobiles. Best-effort; never blocks the field client.
    if (!result.existing && auth.role === "SALES_EXECUTIVE") {
      waitUntilSafe(
        c,
        notifyAdminsOfDayEvent(sql, {
          seUserId: auth.userId!,
          kind: "start",
          at: result.session.startedAt,
        }),
      );
    }

    return c.json(
      success(c, result.session),
      result.existing ? 200 : 201,
    );
  })

  .get("/active", async (c) => {
    const auth = requireRole(c, [...MOBILE_TRACKING_ROLES]);
    const activeSession = await getActiveTrackingSession(getSqlClient(c), auth.userId!);
    return c.json(success(c, { activeSession }));
  })

  .post("/:id/end", async (c) => {
    const auth = requireRole(c, [...MOBILE_TRACKING_ROLES]);
    const body = await readJsonObject(c);
    const sql = getSqlClient(c);
    const { session, justEnded } = await endTrackingSession(sql, {
      userId: auth.userId!,
      trackingSessionId: c.req.param("id"),
      endOdometer: assertOdometer(optionalNumber(body, "endOdometer")),
    });

    // A SALES_EXECUTIVE's manual "End day" (the call that actually ended it) →
    // notify the Super Admins. Logistics "End run" (other role) is excluded, and
    // justEnded guards a replay from re-notifying. Best-effort.
    if (justEnded && auth.role === "SALES_EXECUTIVE") {
      waitUntilSafe(
        c,
        notifyAdminsOfDayEvent(sql, {
          seUserId: auth.userId!,
          kind: "manual_end",
          at: session.endedAt,
        }),
      );
    }

    return c.json(success(c, session));
  })

  // Best-effort beacon from the mobile logout flow: stamps last_signed_out_at so
  // the live map shows a calm "Signed out" instead of red "Tracking interrupted".
  // User-level (no session id) — logout never ends the shared server session.
  .post("/signed-out", async (c) => {
    const auth = requireRole(c, [...MOBILE_TRACKING_ROLES]);
    const result = await recordExecutiveSignedOut(getSqlClient(c), { userId: auth.userId! });
    return c.json(success(c, result));
  })

  .post("/:id/heartbeat", async (c) => {
    const auth = requireRole(c, [...MOBILE_TRACKING_ROLES]);
    const body = await readJsonObject(c);
    // Boundary schema for the bounded numeric fields (audit G-0602); the remaining
    // optional device fields are read below.
    const nums = validate(HeartbeatNumbersSchema, body);
    const batteryPercentage = nums.batteryPercentage ?? null;
    const queuedPointCount = nums.queuedPointCount ?? 0;

    const heartbeat: TrackingHeartbeatInput = {
      deviceId: optionalString(body, "deviceId"),
      capturedAt: optionalString(body, "capturedAt") ?? new Date().toISOString(),
      batteryPercentage,
      isCharging: optionalBoolean(body, "isCharging"),
      isLowPowerModeEnabled: optionalBoolean(body, "isLowPowerModeEnabled"),
      isLocationEnabled: optionalBoolean(body, "isLocationEnabled"),
      foregroundPermission: optionalString(body, "foregroundPermission"),
      backgroundPermission: optionalString(body, "backgroundPermission"),
      notificationPermission: optionalString(body, "notificationPermission"),
      batteryOptimizationStatus: optionalString(body, "batteryOptimizationStatus"),
      networkType: optionalString(body, "networkType"),
      isConnected: optionalBoolean(body, "isConnected"),
      queuedPointCount,
      lastLocationAt: optionalString(body, "lastLocationAt"),
      lastSuccessfulSyncAt: optionalString(body, "lastSuccessfulSyncAt"),
      appVersion: optionalString(body, "appVersion"),
      androidVersion: optionalString(body, "androidVersion"),
      manufacturer: optionalString(body, "manufacturer"),
      model: optionalString(body, "model"),
    };

    const result = await recordTrackingHeartbeat(getSqlClient(c), {
      userId: auth.userId!,
      trackingSessionId: c.req.param("id"),
      heartbeat,
    });
    return c.json(success(c, result), 201);
  })

  .post("/:id/points/batch", async (c) => {
    const auth = requireRole(c, [...MOBILE_TRACKING_ROLES]);
    const body = await readJsonObject(c);
    const rawPoints = body.points;
    if (!Array.isArray(rawPoints)) {
      throw new ApiError("INVALID_FIELD", "points must be an array.", 422);
    }

    const points: TrackingPointInput[] = rawPoints.map((raw, i) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new ApiError("INVALID_FIELD", `points[${i}] must be an object.`, 422);
      }
      const point = raw as Record<string, unknown>;
      return {
        locationPointId: requiredString(point, "locationPointId"),
        latitude: requiredNumber(point, "latitude"),
        longitude: requiredNumber(point, "longitude"),
        accuracy: optionalNumber(point, "accuracy"),
        batteryPercentage: optionalNumber(point, "batteryPercentage"),
        recordedAt: optionalString(point, "recordedAt") ?? new Date().toISOString(),
      };
    });

    const result = await insertTrackingPoints(getSqlClient(c), {
      userId: auth.userId!,
      trackingSessionId: c.req.param("id"),
      points,
      role: auth.role,
    });
    return c.json(success(c, result), 201);
  });
