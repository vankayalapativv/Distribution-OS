import { Hono } from "hono";
import { success } from "../lib/api-response";
import { ApiError } from "../lib/errors";
import { getSqlClient } from "../lib/db";
import { getPublicStatementByToken } from "../services/customer-statement";
import type { ApiEnv } from "../types";

/** Canonical v4-ish uuid shape (any hex variant) — cheap guard before a DB hit. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PUBLIC, no-login customer account-statement. Mounted BEFORE the billing gate
 * and outside every section guard (see index.ts), and deliberately calls NO
 * requireAuth/requireRole — the opaque per-customer token is the only gate.
 * An unknown or malformed token returns 404 (never reveals which it was).
 */
export const publicStatementRoutes = new Hono<ApiEnv>().get(
  "/customer-statement/:token",
  async (c) => {
    const token = c.req.param("token");
    if (!UUID_RE.test(token)) {
      throw new ApiError("NOT_FOUND", "Statement not found.", 404);
    }
    const sql = getSqlClient(c);
    const statement = await getPublicStatementByToken(sql, token);
    if (!statement) {
      throw new ApiError("NOT_FOUND", "Statement not found.", 404);
    }
    return c.json(success(c, statement));
  },
);
