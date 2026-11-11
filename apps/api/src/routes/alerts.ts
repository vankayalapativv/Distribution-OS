import { Hono } from "hono";
import { success } from "../lib/api-response";
import { requireCapability, requireRole } from "../lib/authz";
import { getSqlClient } from "../lib/db";
import { actorOf, logAudit } from "../services/audit";
import { listAlerts, closeAlert } from "../services/alerts";
import type { ApiEnv } from "../types";

export const alertsRoutes = new Hono<ApiEnv>()

  .get("/", async (c) => {
    // sectionGuard("alerts") gates configurable roles; ACCOUNTANT included so a
    // granted Accountant can read (closing is the separate action:alerts.close).
    const auth = requireRole(c, ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"]);
    const sql = getSqlClient(c);
    const url = new URL(c.req.url);
    const filters = {
      status: url.searchParams.get("status") ?? null,
      severity: url.searchParams.get("severity") ?? null,
      alertType: url.searchParams.get("alertType") ?? null,
    };
    const alerts = await listAlerts(sql, { userId: auth.userId! }, filters);
    return c.json(success(c, alerts));
  })

  .post("/:id/close", async (c) => {
    const auth = await requireCapability(c, "action:alerts.close", ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"]);
    const sql = getSqlClient(c);
    const alert = await closeAlert(sql, { userId: auth.userId! }, c.req.param("id"));
    await logAudit(sql, actorOf(auth), {
      action: "alert.close",
      entityType: "alert",
      entityId: c.req.param("id"),
      summary: "Closed an alert",
    });
    return c.json(success(c, alert));
  });
