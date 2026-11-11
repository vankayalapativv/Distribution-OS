import { Hono } from "hono";
import { success } from "../lib/api-response";
import { ApiError } from "../lib/errors";
import { requireRole } from "../lib/authz";
import { getSqlClient } from "../lib/db";
import { readJsonObject } from "../lib/request-body";
import { actorOf, logAudit } from "../services/audit";
import {
  CONFIGURABLE_ROLES,
  getPermissionMatrix,
  isConfigurableRole,
  setRolePermissions,
  type ConfigurableRole,
} from "../services/permissions";
import type { ApiEnv } from "../types";

/**
 * Role-permission management — SUPER_ADMIN only. Controls what MANAGER and
 * ACCOUNTANT can access (section visibility + key actions). Enforcement lives in
 * lib/authz (requireCapability / sectionGuard); this is the config surface.
 */
export const permissionsRoutes = new Hono<ApiEnv>()
  .get("/", async (c) => {
    requireRole(c, ["SUPER_ADMIN"]);
    const matrix = await getPermissionMatrix(getSqlClient(c));
    return c.json(success(c, matrix));
  })
  .put("/:role", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN"]);
    const role = c.req.param("role") as ConfigurableRole;
    if (!isConfigurableRole(role)) {
      throw new ApiError(
        "VALIDATION",
        `Role must be one of: ${CONFIGURABLE_ROLES.join(", ")}.`,
        422,
      );
    }
    const body = await readJsonObject(c);
    const rawEntries = Array.isArray(body.entries) ? body.entries : [];
    const entries = rawEntries
      .filter(
        (e): e is { key: string; allowed: boolean } =>
          !!e &&
          typeof (e as { key?: unknown }).key === "string" &&
          typeof (e as { allowed?: unknown }).allowed === "boolean",
      )
      .map((e) => ({ key: e.key, allowed: e.allowed }));

    const sql = getSqlClient(c);
    const effective = await setRolePermissions(sql, role, entries, auth.userId!);
    await logAudit(sql, actorOf(auth), {
      action: "permissions.update",
      entityType: "role",
      entityId: role,
      entityLabel: role,
      summary: `Updated ${role} permissions (${entries.length} change${entries.length === 1 ? "" : "s"})`,
    });
    return c.json(success(c, { role, permissions: effective }));
  });
