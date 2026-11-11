import { Hono } from "hono";
import { z } from "zod";
import { success } from "../lib/api-response";
import { requireCapability, requireRole } from "../lib/authz";
import { actorOf, logAudit } from "../services/audit";
import { getSqlClient } from "../lib/db";
import { readJsonObject } from "../lib/request-body";
import { validate } from "../lib/validate";
import {
  getMyPerformance,
  listExecutiveTargets,
  OIL_SEGMENTS,
  upsertTarget,
} from "../services/targets";
import type { ApiEnv } from "../types";

// Boundary schema for a target upsert (audit G-0602): the period type is an enum,
// segments a { segment: litres } map.
const TargetPutSchema = z.object({
  periodType: z.enum(["week", "month"]),
  periodDate: z.string().nullish(),
  segments: z.record(z.string(), z.coerce.number()).optional(),
});

export const targetsRoutes = new Hono<ApiEnv>()
  // SE Home screen: today actuals + current week/month actual-vs-target.
  .get("/me", async (c) => {
    const auth = requireRole(c, ["SALES_EXECUTIVE"]);
    const performance = await getMyPerformance(getSqlClient(c), { userId: auth.userId! });
    return c.json(success(c, performance));
  })

  // Admin Targets page: every active SE's target for ONE selected period
  // (periodType + optional periodStart, default = current). Actuals only for
  // the current period; future periods are target-only.
  .get("/", async (c) => {
    // sectionGuard("targets") gates configurable roles; ACCOUNTANT included so a
    // granted Accountant can view (editing is the separate action:targets.edit).
    requireRole(c, ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"]);
    const q = c.req.query();
    const periodType = q.periodType === "month" ? "month" : "week";
    const result = await listExecutiveTargets(getSqlClient(c), {
      periodType,
      periodStart: q.periodStart ?? null,
    });
    return c.json(success(c, result));
  })

  // Set/replace one SE's target for the current (or given) week/month.
  .put("/:userId", async (c) => {
    const auth = await requireCapability(c, "action:targets.edit", ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"]);
    const input = validate(TargetPutSchema, await readJsonObject(c));

    // Accept a `segments` object { [segment]: litres }.
    const rawSegments = input.segments ?? {};
    const segments = OIL_SEGMENTS.map((segment) => ({
      segment,
      litres: rawSegments[segment] ?? 0,
    }));

    const sql = getSqlClient(c);
    const target = await upsertTarget(
      sql,
      { userId: auth.userId! },
      c.req.param("userId"),
      {
        periodType: input.periodType,
        periodDate: input.periodDate ?? null,
        segments,
      },
    );
    await logAudit(sql, actorOf(auth), {
      action: "target.set",
      entityType: "target",
      entityId: target.userId,
      entityLabel: target.seName,
      summary: `Set ${target.periodType} target for ${target.seName} (period ${target.periodStart})`,
    });
    return c.json(success(c, { target }));
  });
