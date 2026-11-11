import { Hono } from "hono";
import { success } from "../lib/api-response";
import { requireRole } from "../lib/authz";
import { getSqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";
import { readJsonObject, requiredNumber, requiredString } from "../lib/request-body";
import { getBeatTemplate, listBeatExecutives } from "../services/beat-plans";
import { assignCustomerToDay, reorderBeatDay, unassignCustomer } from "../services/beat-assign";
import type { ApiEnv } from "../types";

// Beat-plan configuration is office-only: SUPER_ADMIN and MANAGER build each
// executive's recurring Mon–Sat beat. SEs never touch this — they just receive
// today's materialized plan via GET /beats/today.
// sectionGuard("beat-plans") gates configurable roles; ACCOUNTANT included so a
// granted Accountant gets the section (beat-plan view + management).
const ADMIN = ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"] as const;

export const beatPlanRoutes = new Hono<ApiEnv>()
  .get("/executives", async (c) => {
    requireRole(c, [...ADMIN]);
    const executives = await listBeatExecutives(getSqlClient(c));
    return c.json(success(c, { executives }));
  })
  .get("/", async (c) => {
    requireRole(c, [...ADMIN]);
    const executiveId = c.req.query("executiveId") ?? "";
    if (!executiveId) throw new ApiError("INVALID_FIELD", "executiveId is required.", 422);
    const customers = await getBeatTemplate(getSqlClient(c), executiveId);
    return c.json(success(c, { customers }));
  })
  .put("/assign", async (c) => {
    requireRole(c, [...ADMIN]);
    const body = await readJsonObject(c);
    const customerId = requiredString(body, "customerId");
    const weekday = requiredNumber(body, "weekday");
    const result = await assignCustomerToDay(getSqlClient(c), customerId, weekday);
    return c.json(success(c, result));
  })
  // Set one weekday's full membership + visit order (drag-drop reorder / move).
  .put("/reorder", async (c) => {
    requireRole(c, [...ADMIN]);
    const body = await readJsonObject(c);
    const executiveId = requiredString(body, "executiveId");
    const weekday = requiredNumber(body, "weekday");
    const raw = (body as { customerIds?: unknown }).customerIds;
    if (!Array.isArray(raw) || raw.some((v) => typeof v !== "string")) {
      throw new ApiError("INVALID_FIELD", "customerIds must be an array of customer ids.", 422);
    }
    const result = await reorderBeatDay(getSqlClient(c), executiveId, weekday, raw as string[]);
    return c.json(success(c, result));
  })
  .delete("/assign/:customerId", async (c) => {
    requireRole(c, [...ADMIN]);
    const result = await unassignCustomer(getSqlClient(c), c.req.param("customerId"));
    return c.json(success(c, result));
  });
