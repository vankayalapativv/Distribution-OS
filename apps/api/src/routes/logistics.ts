import type { R2Bucket } from "@cloudflare/workers-types";
import { Hono } from "hono";
import { success } from "../lib/api-response";
import { requireRole } from "../lib/authz";
import { getSqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";
import {
  getCustomerDeliveryDetail,
  getDeliveryPhotoStream,
  listDeliveryCustomers,
  listDeliveryStops,
} from "../services/logistics";
import { listDeliveryRuns } from "../services/logistics-runs";
import { getRunDetail } from "../services/logistics-run-detail";
import { getRunsSummary } from "../services/logistics-runs-summary";
import type { ApiEnv } from "../types";

// Web-facing read view of logistics deliveries. The mobile write endpoints
// (/deliveries/*) stay LOGISTICS-only; these are read-only for office roles.
const OFFICE_ROLES = ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"] as const;

function requireBucket(bucket: R2Bucket | undefined): R2Bucket {
  if (!bucket) throw new ApiError("CONFIG", "Photo storage is not configured.", 500);
  return bucket;
}

function paramsFrom(c: { req: { query: (k: string) => string | undefined } }) {
  const n = (k: string) => {
    const v = c.req.query(k);
    return v == null || v === "" ? null : Number(v);
  };
  return {
    q: c.req.query("q") ?? null,
    from: c.req.query("from") ?? null,
    to: c.req.query("to") ?? null,
    sort: c.req.query("sort") ?? null,
    dir: c.req.query("dir") ?? null,
    page: n("page"),
    pageSize: n("pageSize"),
  };
}

export const logisticsRoutes = new Hono<ApiEnv>()
  // Aggregated, sorted, paginated: one row per customer who received a delivery.
  .get("/customers", async (c) => {
    requireRole(c, [...OFFICE_ROLES]);
    const result = await listDeliveryCustomers(getSqlClient(c), paramsFrom(c));
    return c.json(success(c, { customers: result.rows, total: result.total, page: result.page, pageSize: result.pageSize }));
  })
  // Flat, sorted, paginated: one row per delivery stop.
  .get("/deliveries", async (c) => {
    requireRole(c, [...OFFICE_ROLES]);
    const result = await listDeliveryStops(getSqlClient(c), paramsFrom(c));
    return c.json(success(c, { deliveries: result.rows, total: result.total, page: result.page, pageSize: result.pageSize }));
  })
  // Sorted, paginated: one row per delivery run (driver's day with start/end times).
  .get("/runs", async (c) => {
    requireRole(c, [...OFFICE_ROLES]);
    const result = await listDeliveryRuns(getSqlClient(c), paramsFrom(c));
    return c.json(success(c, { runs: result.rows, total: result.total, page: result.page, pageSize: result.pageSize }));
  })
  // Today's (IST) at-a-glance totals for the runs summary strip.
  .get("/runs-summary", async (c) => {
    requireRole(c, [...OFFICE_ROLES]);
    return c.json(success(c, await getRunsSummary(getSqlClient(c))));
  })
  // One run's full detail: start/end bookends + stop timeline with photos.
  .get("/runs/:id", async (c) => {
    requireRole(c, [...OFFICE_ROLES]);
    const detail = await getRunDetail(getSqlClient(c), c.req.param("id"));
    return c.json(success(c, detail));
  })
  // One customer's full delivery history + photos.
  .get("/customers/:id", async (c) => {
    requireRole(c, [...OFFICE_ROLES]);
    const detail = await getCustomerDeliveryDetail(getSqlClient(c), c.req.param("id"), paramsFrom(c));
    return c.json(success(c, detail));
  })
  // Stream a delivery photo's bytes.
  .get("/photos/:photoId", async (c) => {
    requireRole(c, [...OFFICE_ROLES]);
    const { body, contentType } = await getDeliveryPhotoStream(
      getSqlClient(c),
      requireBucket(c.env.PHOTOS),
      c.req.param("photoId"),
    );
    return new Response(body, {
      headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=86400" },
    });
  });
