import { Hono } from "hono";
import { waitUntilSafe } from "../lib/wait-until";
import { success } from "../lib/api-response";
import { requireAuth } from "../lib/authz";
import { getSqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";
import {
  readJsonObject,
  requiredString,
  requiredNumber,
  optionalNumber,
  optionalString,
} from "../lib/request-body";
import { checkIn, checkOut, batchGpsPings, endGpsSession } from "../services/visits";
import { assertCustomerVisible } from "../services/customers";
import { customerName, executiveFirstName, notifyOfficeWebPush, vapidFromEnv } from "../services/web-push-notify";
import { notifyAdmins } from "../services/admin-notify";
import { checkinBody } from "../services/notify-format";
import type { ApiEnv } from "../types";
import type { Context } from "hono";

export const visitsRoutes = new Hono<ApiEnv>()

  .post("/checkin", async (c) => {
    const auth = requireAuth(c);
    const body = await readJsonObject(c);
    const beatPlanStopId = optionalString(body, "beatPlanStopId");
    const customerId = optionalString(body, "customerId");
    if (!beatPlanStopId && !customerId) {
      throw new ApiError(
        "INVALID_FIELD",
        "Provide beatPlanStopId (planned visit) or customerId (unplanned visit).",
        422,
      );
    }
    const latitude = requiredNumber(body, "latitude");
    const longitude = requiredNumber(body, "longitude");
    const accuracy = optionalNumber(body, "accuracy");
    const clientUuid = optionalString(body, "clientUuid");

    const sql = getSqlClient(c);
    if (!beatPlanStopId && customerId && auth.role === "SALES_EXECUTIVE") {
      await assertCustomerVisible(sql, { userId: auth.userId!, role: auth.role }, customerId);
    }
    const result = await checkIn(sql, {
      userId: auth.userId!,
      beatPlanStopId,
      customerId,
      latitude,
      longitude,
      accuracy,
      clientUuid,
    });

    // Context-aware notifications on a fresh check-in (not an offline replay):
    // office Web Push + Super-Admin FCM/Alerts feed, both naming the executive and
    // the shop ("Sandeep · Ravi Motors"). Customer + SE first name fetched once.
    if (!result.existing) {
      const vapid = vapidFromEnv(c.env);
      waitUntilSafe(c, 
        (async () => {
          const [name, se] = await Promise.all([
            customerName(sql, customerId),
            executiveFirstName(sql, auth.userId),
          ]);
          const body = checkinBody(se, name);
          if (vapid) {
            await notifyOfficeWebPush(
              sql,
              vapid,
              { title: "New check-in", body, tag: "sri-aparajita-visit", url: "/tracking" },
              Math.floor(Date.now() / 1000),
            );
          }
          await notifyAdmins(sql, { type: "admin_visit", title: "New check-in", body, customerId });
        })(),
      );
    }
    return c.json(success(c, result), result.existing ? 200 : 201);
  })

  .post("/:id/checkout", async (c) => {
    const auth = requireAuth(c);
    const visitId = c.req.param("id");
    const body = await readJsonObject(c);
    // Manual check-out always carries a GPS fix (geofence + time-spent).
    const latitude = requiredNumber(body, "latitude");
    const longitude = requiredNumber(body, "longitude");
    const accuracy = optionalNumber(body, "accuracy");
    const reason = optionalString(body, "reason");
    const followUpAt = optionalString(body, "followUpAt");

    const sql = getSqlClient(c);
    const result = await checkOut(sql, {
      userId: auth.userId!,
      visitId,
      latitude,
      longitude,
      accuracy,
      reason,
      followUpAt,
    });
    return c.json(success(c, result));
  })

  .post("/gps", handleGpsUpload)
  // Alias for the mobile offline queue — same batch semantics as /gps.
  .post("/gps/batch", handleGpsUpload)

  // End-day: close today's tracking session so the dashboard stops showing
  // it as active. Idempotent.
  .post("/gps/end", async (c) => {
    const auth = requireAuth(c);
    const result = await endGpsSession(getSqlClient(c), { userId: auth.userId! });
    return c.json(success(c, result));
  });

async function handleGpsUpload(c: Context<ApiEnv>) {
  const auth = requireAuth(c);
  const body = await readJsonObject(c);

  const pointsRaw = body.points;
  if (!Array.isArray(pointsRaw)) {
    throw new ApiError("INVALID_FIELD", "points must be an array.", 422);
  }

  const points = pointsRaw.map((p: unknown, i: number) => {
    if (!p || typeof p !== "object" || Array.isArray(p)) {
      throw new ApiError("INVALID_FIELD", `points[${i}] must be an object.`, 422);
    }
    const pt = p as Record<string, unknown>;
    if (typeof pt.latitude !== "number" || typeof pt.longitude !== "number") {
      throw new ApiError("INVALID_FIELD", `points[${i}] must have numeric latitude and longitude.`, 422);
    }
    return {
      latitude: pt.latitude,
      longitude: pt.longitude,
      accuracy: typeof pt.accuracy === "number" ? pt.accuracy : null,
      batteryPercentage: typeof pt.batteryPercentage === "number" ? pt.batteryPercentage : null,
      recordedAt: typeof pt.recordedAt === "string" ? pt.recordedAt : new Date().toISOString(),
    };
  });

  const sql = getSqlClient(c);
  const result = await batchGpsPings(sql, { userId: auth.userId!, points, role: auth.role });
  return c.json(success(c, result), 201);
}
