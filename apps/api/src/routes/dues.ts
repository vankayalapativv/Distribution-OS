import { Hono } from "hono";
import { success } from "../lib/api-response";
import { requireRole } from "../lib/authz";
import { getSqlClient } from "../lib/db";
import {
  getAdminDuesSummary,
  getDuesByExecutive,
  getMyDuesSummary,
  listAdminDuesCustomers,
  listMyDuesCustomers,
  type DuesBucket,
} from "../services/dues";
import type { ApiEnv } from "../types";

/** Collection-dues ageing for the SE mobile Home ("collections dues"). */
export const duesRoutes = new Hono<ApiEnv>()
  .get("/me/summary", async (c) => {
    const auth = requireRole(c, ["SALES_EXECUTIVE"]);
    const sql = getSqlClient(c);
    const summary = await getMyDuesSummary(sql, { userId: auth.userId! });
    return c.json(success(c, summary));
  })
  .get("/me/customers", async (c) => {
    const auth = requireRole(c, ["SALES_EXECUTIVE"]);
    const sql = getSqlClient(c);
    const bucket = c.req.query("bucket") ?? "";
    const customers = await listMyDuesCustomers(sql, { userId: auth.userId! }, bucket);
    return c.json(success(c, { bucket, customers }));
  })
  // MASTER dues across ALL customers (Super Admin mobile + web), optional
  // ?executiveId= to narrow to one SE's customers.
  .get("/summary", async (c) => {
    requireRole(c, ["SUPER_ADMIN", "MANAGER"]);
    const sql = getSqlClient(c);
    const executiveId = c.req.query("executiveId") || null;
    const city = c.req.query("city") || null;
    const summary = await getAdminDuesSummary(sql, { executiveId, city });
    return c.json(success(c, summary));
  })
  // Total dues per SE (Super Admin Home "Dues by executive" card) — every active
  // SE with their total outstanding + owing-customer count, highest first.
  .get("/by-executive", async (c) => {
    requireRole(c, ["SUPER_ADMIN", "MANAGER"]);
    const sql = getSqlClient(c);
    const executives = await getDuesByExecutive(sql);
    return c.json(success(c, { executives }));
  })
  .get("/customers", async (c) => {
    requireRole(c, ["SUPER_ADMIN", "MANAGER"]);
    const sql = getSqlClient(c);
    const bucket = (c.req.query("bucket") ?? "") as DuesBucket;
    const executiveId = c.req.query("executiveId") || null;
    const city = c.req.query("city") || null;
    const customers = await listAdminDuesCustomers(sql, bucket, { executiveId, city });
    return c.json(success(c, { bucket, customers }));
  });
