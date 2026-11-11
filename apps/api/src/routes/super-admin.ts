import { Hono } from "hono";
import { success } from "../lib/api-response";
import { requireRole } from "../lib/authz";
import { actorOf, logAudit } from "../services/audit";
import { getSqlClient } from "../lib/db";
import {
  optionalString,
  readJsonObject,
  requiredString,
} from "../lib/request-body";
import {
  createSuperAdminUser,
  getSuperAdminSetup,
  getUserLatestDevice,
  updateSuperAdminUser,
} from "../services/super-admin";
import type { ApiEnv, Role } from "../types";

export const superAdminRoutes = new Hono<ApiEnv>()
  .get("/setup", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN"]);
    const setup = await getSuperAdminSetup(getSqlClient(c), {
      userId: auth.userId!,
    });

    return c.json(success(c, setup));
  })
  .post("/users", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN"]);
    const body = await readJsonObject(c);
    const sql = getSqlClient(c);
    const role = requiredString(body, "role") as Role;
    const user = await createSuperAdminUser(sql, {
      userId: auth.userId!,
    }, {
      name: requiredString(body, "name"),
      email: optionalString(body, "email"),
      phone: optionalString(body, "phone"),
      role,
      appLoginId: optionalString(body, "appLoginId"),
    });

    await logAudit(sql, actorOf(auth), {
      action: "user.create",
      entityType: "user",
      entityId: user.id,
      entityLabel: user.name,
      summary: `Created user ${user.name} (${role})`,
    });
    return c.json(success(c, user), 201);
  })
  .patch("/users/:id", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN"]);
    const body = await readJsonObject(c);
    const sql = getSqlClient(c);
    const user = await updateSuperAdminUser(
      sql,
      { userId: auth.userId! },
      c.req.param("id"),
      {
        name: requiredString(body, "name"),
        email: optionalString(body, "email"),
        phone: optionalString(body, "phone"),
        status: requiredString(body, "status"),
      },
    );

    await logAudit(sql, actorOf(auth), {
      action: "user.update",
      entityType: "user",
      entityId: user.id,
      entityLabel: user.name,
      summary: `Updated user ${user.name}`,
    });
    return c.json(success(c, user));
  })
  // Latest known mobile device for a user (from tracking heartbeats) — used to
  // label their mobile sessions on the Users screen.
  .get("/users/:id/device", async (c) => {
    requireRole(c, ["SUPER_ADMIN"]);
    const device = await getUserLatestDevice(getSqlClient(c), c.req.param("id"));
    return c.json(success(c, { device }));
  });
