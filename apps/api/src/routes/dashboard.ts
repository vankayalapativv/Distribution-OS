import { Hono } from "hono";
import type { Context } from "hono";
import { success } from "../lib/api-response";
import { requireRole } from "../lib/authz";
import { getSqlClient } from "../lib/db";
import {
  getAccountantDashboard,
  getManagerDashboard,
  getSuperAdminDashboard,
} from "../services/dashboard";
import {
  assertMetric,
  getDashboardMetrics,
  getMetricAgentCustomers,
  getMetricAgents,
  type MetricsRange,
} from "../services/dashboard-metrics";
import {
  getCustomerAnalytics,
  getOilAnalytics,
} from "../services/dashboard-analytics";
import { getSkuAnalytics } from "../services/sku-analytics";
import { getDashboardMapActivity, getDashboardMapCustomers } from "../services/dashboard-map";
import type { ApiEnv } from "../types";

/** from/to query params; both default to today in IST. */
function rangeFromQuery(c: Context<ApiEnv>): MetricsRange {
  const todayIst = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const { from, to } = c.req.query();
  return { from: from ?? todayIst, to: to ?? todayIst };
}

export const dashboardRoutes = new Hono<ApiEnv>()
  // ── Live metrics (2026-07-18): shared by Super-Admin + Manager ──────────
  .get("/metrics", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN", "MANAGER"]);
    const metrics = await getDashboardMetrics(
      getSqlClient(c),
      { userId: auth.userId! },
      rangeFromQuery(c),
    );
    return c.json(success(c, metrics));
  })
  .get("/metrics/:metric/agents", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN", "MANAGER"]);
    const agents = await getMetricAgents(
      getSqlClient(c),
      { userId: auth.userId! },
      assertMetric(c.req.param("metric")),
      rangeFromQuery(c),
    );
    return c.json(success(c, { agents }));
  })
  .get("/metrics/:metric/agents/:agentId/customers", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN", "MANAGER"]);
    const rows = await getMetricAgentCustomers(
      getSqlClient(c),
      { userId: auth.userId! },
      assertMetric(c.req.param("metric")),
      c.req.param("agentId"),
      rangeFromQuery(c),
    );
    return c.json(success(c, { rows }));
  })

  // ── Dashboard map (2026-09-07): customer pins + today's field activity ───
  .get("/map", async (c) => {
    requireRole(c, ["SUPER_ADMIN", "MANAGER"]);
    const { customers, bands } = await getDashboardMapCustomers(getSqlClient(c));
    return c.json(success(c, { customers, bands }));
  })
  .get("/map/activity", async (c) => {
    requireRole(c, ["SUPER_ADMIN", "MANAGER"]);
    const activity = await getDashboardMapActivity(getSqlClient(c));
    return c.json(success(c, activity));
  })

  // ── SKU analytics — Billed (from invoices) (2026-07-23) ──────────────────
  .get("/sku-analytics", async (c) => {
    requireRole(c, ["SUPER_ADMIN", "MANAGER"]);
    const data = await getSkuAnalytics(getSqlClient(c), rangeFromQuery(c));
    return c.json(success(c, data));
  })

  // ── Product & Customer analytics tables (2026-07-20) ────────────────────
  .get("/analytics/oils", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN", "MANAGER"]);
    const data = await getOilAnalytics(
      getSqlClient(c),
      { userId: auth.userId! },
      rangeFromQuery(c),
    );
    return c.json(success(c, data));
  })
  .get("/analytics/customers", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN", "MANAGER"]);
    const data = await getCustomerAnalytics(
      getSqlClient(c),
      { userId: auth.userId! },
      rangeFromQuery(c),
      { includeInactive: c.req.query("includeInactive") === "true" },
    );
    return c.json(success(c, data));
  })
  .get("/super-admin", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN"]);
    const dashboard = await getSuperAdminDashboard(getSqlClient(c), {
      userId: auth.userId!,
    });

    return c.json(success(c, dashboard));
  })
  .get("/manager", async (c) => {
    const auth = requireRole(c, ["MANAGER"]);
    const dashboard = await getManagerDashboard(getSqlClient(c), {
      userId: auth.userId!,
    });

    return c.json(success(c, dashboard));
  })
  .get("/accountant", async (c) => {
    const auth = requireRole(c, ["ACCOUNTANT"]);
    const dashboard = await getAccountantDashboard(getSqlClient(c), {
      userId: auth.userId!,
    });

    return c.json(success(c, dashboard));
  });
