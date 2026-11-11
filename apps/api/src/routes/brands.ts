import { Hono } from "hono";
import { success } from "../lib/api-response";
import { requireRole } from "../lib/authz";
import { getSqlClient } from "../lib/db";
import { assertBrandCategory, listBrands } from "../services/brands";
import type { ApiEnv } from "../types";

export const brandsRoutes = new Hono<ApiEnv>().get("/", async (c) => {
  requireRole(c, ["SUPER_ADMIN", "MANAGER"]);
  const category = assertBrandCategory(c.req.query("category"));
  const brands = await listBrands(getSqlClient(c), category);
  return c.json(success(c, { brands }));
});
