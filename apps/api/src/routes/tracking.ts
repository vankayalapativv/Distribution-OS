import { Hono } from "hono";
import { success } from "../lib/api-response";
import { requireRole } from "../lib/authz";
import { getSqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";
import {
  assertTrackingDate,
  getExecutiveCheckins,
  getExecutiveRoute,
  listDeviceHealth,
  listTrackedExecutives,
} from "../services/tracking";
import type { ApiEnv } from "../types";

/** Live GPS tracking is a supervision feature: SUPER_ADMIN and MANAGER only. */
// sectionGuard("tracking") is the real gate; ACCOUNTANT included so a granted
// Accountant can view (all tracking endpoints here are read-only).
const TRACKING_ROLES = ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"] as const;

/** Today's date in IST — the field team's day, not UTC's. */
function todayIst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());
}

export const trackingRoutes = new Hono<ApiEnv>()
  .get("/executives", async (c) => {
    requireRole(c, [...TRACKING_ROLES]);
    const date = assertTrackingDate(c.req.query("date") ?? todayIst());
    const executives = await listTrackedExecutives(getSqlClient(c), date);
    return c.json(success(c, { executives, date }));
  })
  .get("/route", async (c) => {
    requireRole(c, [...TRACKING_ROLES]);
    const userId = c.req.query("userId");
    if (!userId) {
      throw new ApiError("INVALID_FIELD", "userId is required.", 422);
    }
    const date = assertTrackingDate(c.req.query("date") ?? todayIst());
    const points = await getExecutiveRoute(getSqlClient(c), userId, date);
    return c.json(success(c, { points, date }));
  })
  .get("/checkins", async (c) => {
    requireRole(c, [...TRACKING_ROLES]);
    const userId = c.req.query("userId");
    if (!userId) {
      throw new ApiError("INVALID_FIELD", "userId is required.", 422);
    }
    const date = assertTrackingDate(c.req.query("date") ?? todayIst());
    const checkins = await getExecutiveCheckins(getSqlClient(c), userId, date);
    return c.json(success(c, { checkins, date }));
  })
  .get("/device-health", async (c) => {
    requireRole(c, [...TRACKING_ROLES]);
    const date = assertTrackingDate(c.req.query("date") ?? todayIst());
    const devices = await listDeviceHealth(getSqlClient(c), date);
    return c.json(success(c, { devices, date }));
  });
