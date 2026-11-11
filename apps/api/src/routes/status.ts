import { Hono } from "hono";
import { success } from "../lib/api-response";
import { getSqlClient } from "../lib/db";
import { buildStatusSummary, emptyState, readState } from "../services/health-history";
import { inStatusWindow, probeComponents } from "../services/health-monitor";
import type { ApiEnv } from "../types";

/**
 * Public status summary for the /status page: per-component 90-day history bars
 * + uptime % (from the R2 history). No auth — it must work during an outage.
 *
 * The DB is only touched during the monitored window (9AM–9PM IST Mon–Sat) so a
 * left-open page can't keep Neon awake overnight (matching the cost window that
 * lets Neon scale to zero). INSIDE the window we live-probe for a real-time
 * banner; OUTSIDE it we serve the last recorded status from R2 (labelled by its
 * own timestamp) and never query the DB.
 */
export const statusRoutes = new Hono<ApiEnv>().get("/status-summary", async (c) => {
  const bucket = c.env.PHOTOS;
  const state = bucket ? await readState(bucket) : emptyState();
  const live = inStatusWindow();

  if (live) {
    const sql = c.env.DATABASE_URL ? getSqlClient(c) : null;
    const probed = await probeComponents(c.env, sql);
    state.current = { ...state.current, ...probed };
  } else {
    // Off-hours: no DB probe. The API is up (we're serving this); the database
    // status stays as the monitor last recorded it (from R2).
    state.current = {
      ...state.current,
      api: { status: "ok", latencyMs: null, observedAt: new Date().toISOString() },
    };
  }

  // `live` tells the page whether these figures are a fresh check (inside the
  // 9–9 window) or last-known — so it doesn't show a bogus "last checked" time.
  return c.json(success(c, { ...buildStatusSummary(state), live }));
});
