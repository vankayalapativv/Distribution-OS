import { Hono } from "hono";
import { success } from "../lib/api-response";
import { requireRole } from "../lib/authz";
import { getSqlClient } from "../lib/db";
import { optionalNumber, optionalString, readJsonObject, requiredString } from "../lib/request-body";
import {
  createMarginSimulation,
  deleteMarginSimulation,
  listMarginSimulations,
  updateMarginSimulation,
  type MarginSimInput,
} from "../services/margin";
import { actorOf, logAudit } from "../services/audit";
import type { ApiEnv } from "../types";

/** Margin Simulator — SUPER_ADMIN only (oils margin scenarios, save/reopen). */
function inputFrom(body: Record<string, unknown>): MarginSimInput {
  return {
    productId: optionalString(body, "productId"),
    productName: requiredString(body, "productName"),
    packSize: optionalNumber(body, "packSize") ?? 0,
    mrp: optionalNumber(body, "mrp"),
    dlp: optionalNumber(body, "dlp") ?? 0,
    expensePerLiter: optionalNumber(body, "expensePerLiter") ?? 0,
    schemePerLiter: optionalNumber(body, "schemePerLiter") ?? 0,
    coupon: optionalNumber(body, "coupon"),
    mop: optionalNumber(body, "mop") ?? 0,
  };
}

export const marginRoutes = new Hono<ApiEnv>()
  .get("/", async (c) => {
    requireRole(c, ["SUPER_ADMIN"]);
    const rows = await listMarginSimulations(getSqlClient(c));
    return c.json(success(c, { rows }));
  })
  .post("/", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN"]);
    const body = await readJsonObject(c);
    const sql = getSqlClient(c);
    const row = await createMarginSimulation(sql, { userId: auth.userId! }, inputFrom(body));
    await logAudit(sql, actorOf(auth), {
      action: "margin_simulation.create",
      entityType: "margin_simulation",
      entityId: row.id,
      entityLabel: row.productName,
      summary: `Saved margin scenario for ${row.productName}`,
    });
    return c.json(success(c, { row }), 201);
  })
  .patch("/:id", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN"]);
    const body = await readJsonObject(c);
    const sql = getSqlClient(c);
    const row = await updateMarginSimulation(sql, c.req.param("id"), inputFrom(body));
    await logAudit(sql, actorOf(auth), {
      action: "margin_simulation.update",
      entityType: "margin_simulation",
      entityId: c.req.param("id"),
      entityLabel: row.productName,
      summary: `Updated margin scenario for ${row.productName}`,
    });
    return c.json(success(c, { row }));
  })
  .delete("/:id", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN"]);
    const sql = getSqlClient(c);
    await deleteMarginSimulation(sql, c.req.param("id"));
    await logAudit(sql, actorOf(auth), {
      action: "margin_simulation.delete",
      entityType: "margin_simulation",
      entityId: c.req.param("id"),
      summary: "Deleted a margin scenario",
    });
    return c.json(success(c, { ok: true }));
  });
