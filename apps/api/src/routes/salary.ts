import { Hono } from "hono";
import { success } from "../lib/api-response";
import { requireCapability, requireRole } from "../lib/authz";
import { actorOf, logAudit } from "../services/audit";
import { getSqlClient } from "../lib/db";
import { optionalNumber, optionalString, readJsonObject, requiredString } from "../lib/request-body";
import { listSalaries, listStaff, mySalary, paySalary, setSalary } from "../services/salary";
import type { ApiEnv, Role } from "../types";

const FIELD_ROLES: Role[] = ["SALES_EXECUTIVE", "LOGISTICS"];
const OFFICE_ROLES: Role[] = ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"];
const VIEW = "action:salary.view";
const MANAGE = "action:salary.manage";

export const salaryRoutes = new Hono<ApiEnv>()
  // Field: my salary, advance outstanding, and this month's pay.
  .get("/mine", async (c) => {
    const auth = requireRole(c, FIELD_ROLES);
    return c.json(success(c, await mySalary(getSqlClient(c), auth.userId!)));
  })

  // Office: the salary table (others' salaries) — gated by salary.view.
  .get("/", async (c) => {
    await requireCapability(c, VIEW, OFFICE_ROLES);
    return c.json(success(c, await listSalaries(getSqlClient(c))));
  })

  // Office: all staff, for the "set salary" person picker — gated by salary.view.
  .get("/staff", async (c) => {
    await requireCapability(c, VIEW, OFFICE_ROLES);
    return c.json(success(c, await listStaff(getSqlClient(c))));
  })

  // Office: set / change a salary — gated by salary.manage.
  .post("/set", async (c) => {
    const auth = await requireCapability(c, MANAGE, OFFICE_ROLES);
    const body = await readJsonObject(c);
    const sql = getSqlClient(c);
    const saved = await setSalary(sql, auth.userId!, requiredString(body, "userId"), optionalNumber(body, "amount") ?? 0, optionalString(body, "effectiveFrom"));
    await logAudit(sql, actorOf(auth), { action: "salary.set", entityType: "salary", entityId: saved.userId, summary: `Set a salary — ₹${saved.monthlyAmount.toLocaleString("en-IN")}` });
    return c.json(success(c, saved));
  })

  // Office: pay a person's salary for a month — gated by salary.manage.
  .post("/pay", async (c) => {
    const auth = await requireCapability(c, MANAGE, OFFICE_ROLES);
    const body = await readJsonObject(c);
    const sql = getSqlClient(c);
    const result = await paySalary(sql, auth.userId!, requiredString(body, "userId"), requiredString(body, "periodMonth"), optionalString(body, "paymentMode"));
    await logAudit(sql, actorOf(auth), {
      action: "salary.pay",
      entityType: "salary",
      entityId: result.userId,
      summary: `Paid salary — net ₹${result.net.toLocaleString("en-IN")} (recovered ₹${result.advanceRecovered.toLocaleString("en-IN")})`,
      metadata: { gross: result.gross, net: result.net },
    });
    return c.json(success(c, result), 201);
  });
