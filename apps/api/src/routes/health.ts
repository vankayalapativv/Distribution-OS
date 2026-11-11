import { Hono } from "hono";
import { success } from "../lib/api-response";
import { getSqlClient } from "../lib/db";
import { checkHealth, degradedMsFromEnv } from "../services/health";
import { missingRequiredEnv } from "../lib/env";
import type { ApiEnv } from "../types";

export const healthRoutes = new Hono<ApiEnv>().get("/health", async (c) => {
  const sql = c.env.DATABASE_URL ? getSqlClient(c) : null;
  const snapshot = await checkHealth(sql, { degradedMs: degradedMsFromEnv(c.env) });

  const body = success(c, {
    service: "api",
    environment: c.env.ENVIRONMENT ?? "development",
    // Whether the core required config is present (no names/values leaked).
    configOk: missingRequiredEnv(c.env as unknown as Record<string, unknown>).length === 0,
    ...snapshot,
  });

  // "down" (DB unreachable) → 503 so an external monitor can catch it too;
  // "ok"/"degraded" are still serving → 200. The body carries the exact status.
  return c.json(body, snapshot.status === "down" ? 503 : 200);
});
