import { Hono } from "hono";
import { success } from "../lib/api-response";
import { requireCapability, requireRole } from "../lib/authz";
import { actorOf, logAudit } from "../services/audit";
import { getSqlClient } from "../lib/db";
import { optionalNumber, optionalString, readJsonObject, requiredString } from "../lib/request-body";
import {
  approveAdvance,
  listAdvances,
  myAdvances,
  perPersonAdvanceBalances,
  recordAdvance,
  rejectAdvance,
  requestAdvance,
} from "../services/advances";
import type { ApiEnv, Role } from "../types";

const FIELD_ROLES: Role[] = ["SALES_EXECUTIVE", "LOGISTICS"];
const OFFICE_ROLES: Role[] = ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"];
const MANAGE = "action:expenditures.advances.manage";
const APPROVE = "action:expenditures.advances.approve";

const planOf = (body: Record<string, unknown>) => ({
  recoveryPlan: requiredString(body, "recoveryPlan"),
  installmentAmount: optionalNumber(body, "installmentAmount"),
});

export const advancesRoutes = new Hono<ApiEnv>()
  // Field: request an advance.
  .post("/", async (c) => {
    const auth = requireRole(c, FIELD_ROLES);
    const body = await readJsonObject(c);
    const sql = getSqlClient(c);
    const advance = await requestAdvance(sql, auth.userId!, optionalNumber(body, "amount") ?? 0, optionalString(body, "reason"));
    await logAudit(sql, actorOf(auth), { action: "advance.request", entityType: "advance", entityId: advance.id, summary: `Requested an advance — ₹${advance.amount.toLocaleString("en-IN")}` });
    return c.json(success(c, advance), 201);
  })

  // Field: my advances + outstanding total.
  .get("/mine", async (c) => {
    const auth = requireRole(c, FIELD_ROLES);
    return c.json(success(c, await myAdvances(getSqlClient(c), auth.userId!)));
  })

  // Office: each person's outstanding advance balance.
  .get("/balances", async (c) => {
    requireRole(c, OFFICE_ROLES);
    return c.json(success(c, await perPersonAdvanceBalances(getSqlClient(c))));
  })

  // Office: advances by status (default = pending requests).
  .get("/", async (c) => {
    requireRole(c, OFFICE_ROLES);
    return c.json(success(c, await listAdvances(getSqlClient(c), c.req.query("status") ?? "requested")));
  })

  // Office: record a direct advance — gated by advances.manage.
  .post("/record", async (c) => {
    const auth = await requireCapability(c, MANAGE, OFFICE_ROLES);
    const body = await readJsonObject(c);
    const sql = getSqlClient(c);
    const advance = await recordAdvance(sql, auth.userId!, {
      userId: requiredString(body, "userId"),
      amount: optionalNumber(body, "amount") ?? 0,
      reason: optionalString(body, "reason"),
      ...planOf(body),
    });
    await logAudit(sql, actorOf(auth), { action: "advance.record", entityType: "advance", entityId: advance.id, summary: `Recorded an advance — ₹${advance.amount.toLocaleString("en-IN")}`, metadata: { amount: advance.amount } });
    return c.json(success(c, advance), 201);
  })

  // Office: approve a requested advance — gated by advances.approve.
  .post("/:id/approve", async (c) => {
    const auth = await requireCapability(c, APPROVE, OFFICE_ROLES);
    const body = await readJsonObject(c);
    const sql = getSqlClient(c);
    const advance = await approveAdvance(sql, auth.userId!, c.req.param("id"), planOf(body));
    await logAudit(sql, actorOf(auth), { action: "advance.approve", entityType: "advance", entityId: advance.id, summary: `Approved an advance — ₹${advance.amount.toLocaleString("en-IN")}`, metadata: { amount: advance.amount } });
    return c.json(success(c, advance));
  })

  // Office: reject a requested advance — gated by advances.approve.
  .post("/:id/reject", async (c) => {
    const auth = await requireCapability(c, APPROVE, OFFICE_ROLES);
    const body = await readJsonObject(c);
    const sql = getSqlClient(c);
    const advance = await rejectAdvance(sql, auth.userId!, c.req.param("id"), requiredString(body, "reason"));
    await logAudit(sql, actorOf(auth), { action: "advance.reject", entityType: "advance", entityId: advance.id, summary: "Rejected an advance request" });
    return c.json(success(c, advance));
  });
