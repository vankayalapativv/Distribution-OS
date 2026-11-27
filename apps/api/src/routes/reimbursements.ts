import { Hono } from "hono";
import { success } from "../lib/api-response";
import { requireCapability, requireRole } from "../lib/authz";
import { actorOf, logAudit } from "../services/audit";
import { getSqlClient } from "../lib/db";
import { optionalString, readJsonObject } from "../lib/request-body";
import {
  listPayables,
  markPaid,
  myReimbursements,
  perPersonBalances,
} from "../services/reimbursement-payables";
import type { ApiEnv, Role } from "../types";

const FIELD_ROLES: Role[] = ["SALES_EXECUTIVE", "LOGISTICS"];
const OFFICE_ROLES: Role[] = ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"];
const PAY = "action:expenditures.reimbursements.pay";

export const reimbursementsRoutes = new Hono<ApiEnv>()
  // Field: what the company owes me + my reimbursement history.
  .get("/mine", async (c) => {
    const auth = requireRole(c, FIELD_ROLES);
    return c.json(success(c, await myReimbursements(getSqlClient(c), auth.userId!)));
  })

  // Office: each person the company owes, most first.
  .get("/balances", async (c) => {
    requireRole(c, OFFICE_ROLES);
    return c.json(success(c, await perPersonBalances(getSqlClient(c))));
  })

  // Office: the settle queue (default = still owed).
  .get("/", async (c) => {
    requireRole(c, OFFICE_ROLES);
    return c.json(success(c, await listPayables(getSqlClient(c), c.req.query("status") ?? "owed")));
  })

  // Office: settle a payable — gated by the reimbursements.pay permission.
  .post("/:id/pay", async (c) => {
    const auth = await requireCapability(c, PAY, OFFICE_ROLES);
    const body = await readJsonObject(c).catch(() => ({}));
    const sql = getSqlClient(c);
    const payable = await markPaid(sql, auth.userId!, c.req.param("id"), optionalString(body, "paymentMode"));
    await logAudit(sql, actorOf(auth), {
      action: "reimbursement.pay",
      entityType: "reimbursement_payable",
      entityId: payable.id,
      summary: `Paid a reimbursement — ₹${payable.amount.toLocaleString("en-IN")}`,
      metadata: { amount: payable.amount },
    });
    return c.json(success(c, payable));
  });
