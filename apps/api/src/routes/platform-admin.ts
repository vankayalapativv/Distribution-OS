import { Hono } from "hono";
import { success } from "../lib/api-response";
import { requireNeonIdentity } from "../lib/authz";
import { getOwnerSqlClient } from "../lib/db";
import { readJsonObject, requiredNumber, requiredString, optionalNumber } from "../lib/request-body";
import {
  approveEnterprise,
  getEnterpriseDetail,
  listEnterprises,
  rejectEnterprise,
  resolvePlatformOwner,
} from "../services/platform-admin";
import type { ApiEnv } from "../types";

/**
 * Platform-owner cockpit API (the `admin.` surface). Every handler verifies the
 * caller is a platform owner and runs on the owner client (cross-enterprise).
 * Mounted outside the billing gate.
 */
export const platformAdminRoutes = new Hono<ApiEnv>()
  .get("/enterprises", async (c) => {
    const { externalUserId } = requireNeonIdentity(c);
    const sql = getOwnerSqlClient(c);
    await resolvePlatformOwner(sql, externalUserId);
    const status = c.req.query("status");
    return c.json(success(c, { enterprises: await listEnterprises(sql, { status }) }));
  })
  .get("/enterprises/:id", async (c) => {
    const { externalUserId } = requireNeonIdentity(c);
    const sql = getOwnerSqlClient(c);
    await resolvePlatformOwner(sql, externalUserId);
    return c.json(success(c, await getEnterpriseDetail(sql, c.req.param("id"))));
  })
  .post("/enterprises/:id/approve", async (c) => {
    const { externalUserId } = requireNeonIdentity(c);
    const sql = getOwnerSqlClient(c);
    const ownerId = await resolvePlatformOwner(sql, externalUserId);
    const body = await readJsonObject(c);
    const result = await approveEnterprise(sql, ownerId, c.req.param("id"), {
      model: requiredString(body, "model") as "per_seat" | "flat",
      amountPaisa: requiredNumber(body, "amountPaisa"),
      gstRateBp: optionalNumber(body, "gstRateBp") ?? undefined,
    });
    return c.json(success(c, result));
  })
  .post("/enterprises/:id/reject", async (c) => {
    const { externalUserId } = requireNeonIdentity(c);
    const sql = getOwnerSqlClient(c);
    const ownerId = await resolvePlatformOwner(sql, externalUserId);
    const body = await readJsonObject(c);
    const result = await rejectEnterprise(sql, ownerId, c.req.param("id"), requiredString(body, "reason"));
    return c.json(success(c, result));
  });
