import { Hono } from "hono";
import { success } from "../lib/api-response";
import { requireRole } from "../lib/authz";
import { getSqlClient } from "../lib/db";
import {
  buildBrandsSummary,
  buildOneReport,
  buildSummary,
  isReportKey,
  type ReportCadence,
} from "../services/reports";
import { profitReport } from "../services/profit";
import type { ApiEnv } from "../types";

const CADENCES: ReportCadence[] = ["daily", "weekly", "fortnightly", "monthly"];

function parseCadence(v: string | undefined): ReportCadence {
  return CADENCES.includes(v as ReportCadence) ? (v as ReportCadence) : "daily";
}

export const reportsRoutes = new Hono<ApiEnv>()
  // Reports for one cadence (default 'daily'), as of `anchor` (IST date, default
  // today). `report` selects what to build so the page can fetch lazily:
  //   report=summary → light KPI/card aggregates (loads the overview)
  //   report=<key>   → one report's full detail (fetched when a card opens)
  .get("/", async (c) => {
    requireRole(c, ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"]);
    const q = c.req.query();
    const sql = getSqlClient(c);
    // The interactive Reports page sends from/to (a custom range that overrides
    // the cadence preset). cadence is kept as a fallback + for back-compat links.
    const opts = {
      cadence: parseCadence(q.cadence),
      anchor: q.anchor ?? null,
      from: q.from ?? null,
      to: q.to ?? null,
      brand: q.brand ?? null,
    };
    const report = q.report ?? "summary";

    if (isReportKey(report)) {
      return c.json(success(c, await buildOneReport(sql, opts, report)));
    }
    return c.json(success(c, await buildSummary(sql, opts)));
  })
  // Profitability report: sold − expense share − actual cost, grouped by
  // invoice / customer / sku / area (generated invoices only).
  .get("/profit", async (c) => {
    requireRole(c, ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"]);
    const q = c.req.query();
    const result = await profitReport(getSqlClient(c), { from: q.from ?? null, to: q.to ?? null, groupBy: q.groupBy ?? null });
    return c.json(success(c, result));
  })
  // Per-brand teasers for the dedicated brand report cards (real numbers).
  .get("/brands-summary", async (c) => {
    requireRole(c, ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"]);
    const q = c.req.query();
    const opts = {
      cadence: parseCadence(q.cadence),
      anchor: q.anchor ?? null,
      from: q.from ?? null,
      to: q.to ?? null,
    };
    return c.json(success(c, await buildBrandsSummary(getSqlClient(c), opts)));
  });
