import { Hono } from "hono";
import { success } from "../lib/api-response";
import { requireAuth } from "../lib/authz";
import { getSqlClient } from "../lib/db";
import { getTodayBeatPlan } from "../services/beats";
import type { ApiEnv } from "../types";

export const beatsRoutes = new Hono<ApiEnv>()

  .get("/today", async (c) => {
    const auth = requireAuth(c);
    const sql = getSqlClient(c);
    const plan = await getTodayBeatPlan(sql, { userId: auth.userId! });
    return c.json(success(c, plan));
  });
