import { Hono } from "hono";
import { success } from "../lib/api-response";
import { requireRole } from "../lib/authz";
import { getSqlClient } from "../lib/db";
import { auditLogFilterOptions, listAuditLogsPaged } from "../services/audit-logs";
import type { ApiEnv } from "../types";

const num = (v: string | undefined) => (v == null || v === "" ? null : Number(v));

/** SUPER_ADMIN-only audit-log surface (read-only). */
export const auditLogRoutes = new Hono<ApiEnv>()
  .get("/paged", async (c) => {
    requireRole(c, ["SUPER_ADMIN"]);
    const q = c.req.query();
    const result = await listAuditLogsPaged(getSqlClient(c), {
      q: q.q ?? null,
      actorId: q.actorId ?? null,
      entityType: q.entityType ?? null,
      action: q.action ?? null,
      fromDate: q.fromDate ?? null,
      toDate: q.toDate ?? null,
      sort: q.sort ?? null,
      dir: q.dir ?? null,
      page: num(q.page),
      pageSize: num(q.pageSize),
    });
    return c.json(
      success(c, {
        auditLogs: result.rows,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      }),
    );
  })
  .get("/filters", async (c) => {
    requireRole(c, ["SUPER_ADMIN"]);
    const filters = await auditLogFilterOptions(getSqlClient(c));
    return c.json(success(c, filters));
  });
