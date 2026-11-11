import { Hono } from "hono";
import { success } from "../lib/api-response";
import { requireRole } from "../lib/authz";
import { getSqlClient } from "../lib/db";
import { oilLeaderboard, oilSegmentLeaderboard } from "../services/leaderboard";
import type { ApiEnv } from "../types";

/** SE oil-litres leaderboard — the peer ranking every Sales Executive sees, plus
 *  SUPER_ADMIN (the SA mobile Home shows the same board). Data is identical for
 *  both; only the caller's own-row highlight differs (an SA isn't in the list). */
export const leaderboardRoutes = new Hono<ApiEnv>()
  .get("/", async (c) => {
    requireRole(c, ["SALES_EXECUTIVE", "SUPER_ADMIN"]);
    const leaderboard = await oilLeaderboard(getSqlClient(c));
    return c.json(success(c, { leaderboard }));
  })
  // Per-SE, per-segment litres for the SA Home "Sales by segment" card.
  .get("/segments", async (c) => {
    requireRole(c, ["SUPER_ADMIN"]);
    const rows = await oilSegmentLeaderboard(getSqlClient(c));
    return c.json(success(c, { rows }));
  });
