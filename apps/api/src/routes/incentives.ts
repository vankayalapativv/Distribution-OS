import { Hono } from "hono";
import { success } from "../lib/api-response";
import { requireRole } from "../lib/authz";
import { getSqlClient } from "../lib/db";
import { optionalNumber, readJsonObject, requiredString } from "../lib/request-body";
import { actorOf, logAudit } from "../services/audit";
import { listIncentives, upsertIncentive } from "../services/incentives";
import type { ApiEnv } from "../types";

export const incentivesRoutes = new Hono<ApiEnv>()
  // Incentives page: every active SE's monthly collections + litres + the
  // manually-set knobs and computed payouts, for one month (?month=YYYY-MM).
  .get("/", async (c) => {
    requireRole(c, ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"]);
    const result = await listIncentives(getSqlClient(c), { month: c.req.query("month") ?? null });
    return c.json(success(c, result));
  })

  // Set one SE's incentive knobs for a month.
  .put("/:userId", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"]);
    const body = await readJsonObject(c);
    const userId = c.req.param("userId");
    const month = requiredString(body, "month");
    const sql = getSqlClient(c);

    await upsertIncentive(sql, { userId: auth.userId! }, userId, {
      month,
      collectionPct: optionalNumber(body, "collectionPct"),
      perLitreRate: optionalNumber(body, "perLitreRate"),
      targetLitres: optionalNumber(body, "targetLitres"),
      targetReward: optionalNumber(body, "targetReward"),
    });

    await logAudit(sql, actorOf(auth), {
      action: "incentive.set",
      entityType: "se_incentive",
      entityId: userId,
      summary: `Set incentive knobs for SE ${userId} (month ${month})`,
      metadata: { month },
    });

    return c.json(success(c, { ok: true }));
  });
