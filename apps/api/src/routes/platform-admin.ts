import { Hono } from "hono";
import { success } from "../lib/api-response";
import { requireNeonIdentity } from "../lib/authz";
import { getOwnerSqlClient } from "../lib/db";
import {
  readJsonObject,
  requiredNumber,
  requiredString,
  optionalNumber,
  optionalBoolean,
  optionalString,
} from "../lib/request-body";
import {
  approveEnterprise,
  getEnterpriseDetail,
  listEnterprises,
  listEnterpriseCharges,
  rejectEnterprise,
  resolvePlatformOwner,
  setEnterpriseEnforcement,
  setEnterpriseStatus,
  updateEnterpriseDuesBands,
  updateEnterpriseFreePeriod,
  updateEnterpriseInvoiceSeries,
  updateEnterprisePricing,
  updateEnterpriseProfile,
  updateEnterpriseSettings,
  upsertEnterpriseGodowns,
  type DuesBandInput,
  type GodownInput,
} from "../services/platform-admin";
import { ApiError } from "../lib/errors";
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
      freeMonths: optionalNumber(body, "freeMonths") ?? undefined,
      freeForever: optionalBoolean(body, "freeForever") ?? undefined,
    });
    return c.json(success(c, result));
  })
  .post("/enterprises/:id/pricing", async (c) => {
    const { externalUserId } = requireNeonIdentity(c);
    const sql = getOwnerSqlClient(c);
    const ownerId = await resolvePlatformOwner(sql, externalUserId);
    const body = await readJsonObject(c);
    const result = await updateEnterprisePricing(sql, ownerId, c.req.param("id"), {
      model: requiredString(body, "model") as "per_seat" | "flat",
      amountPaisa: requiredNumber(body, "amountPaisa"),
      gstRateBp: optionalNumber(body, "gstRateBp") ?? undefined,
      freeMonths: optionalNumber(body, "freeMonths") ?? undefined,
      freeForever: optionalBoolean(body, "freeForever") ?? undefined,
    });
    return c.json(success(c, result));
  })
  .post("/enterprises/:id/free-period", async (c) => {
    const { externalUserId } = requireNeonIdentity(c);
    const sql = getOwnerSqlClient(c);
    const ownerId = await resolvePlatformOwner(sql, externalUserId);
    const body = await readJsonObject(c);
    const result = await updateEnterpriseFreePeriod(sql, ownerId, c.req.param("id"), {
      freeMonths: optionalNumber(body, "freeMonths") ?? undefined,
      freeForever: optionalBoolean(body, "freeForever") ?? undefined,
    });
    return c.json(success(c, result));
  })
  .post("/enterprises/:id/status", async (c) => {
    const { externalUserId } = requireNeonIdentity(c);
    const sql = getOwnerSqlClient(c);
    const ownerId = await resolvePlatformOwner(sql, externalUserId);
    const body = await readJsonObject(c);
    // `op` (not `action`): the web BFF consumes `action` to route to this endpoint.
    const op = requiredString(body, "op");
    if (op !== "suspend" && op !== "reactivate")
      throw new ApiError("VALIDATION", "op must be suspend or reactivate.", 422);
    const result = await setEnterpriseStatus(sql, ownerId, c.req.param("id"), op);
    return c.json(success(c, result));
  })
  .post("/enterprises/:id/profile", async (c) => {
    const { externalUserId } = requireNeonIdentity(c);
    const sql = getOwnerSqlClient(c);
    const ownerId = await resolvePlatformOwner(sql, externalUserId);
    const body = await readJsonObject(c);
    const result = await updateEnterpriseProfile(sql, ownerId, c.req.param("id"), {
      name: optionalString(body, "name") ?? undefined,
      legalName: optionalString(body, "legalName") ?? undefined,
      gstin: optionalString(body, "gstin") ?? undefined,
      contactName: optionalString(body, "contactName") ?? undefined,
      contactPhone: optionalString(body, "contactPhone") ?? undefined,
      contactEmail: optionalString(body, "contactEmail") ?? undefined,
      addressLine1: optionalString(body, "addressLine1") ?? undefined,
      addressLine2: optionalString(body, "addressLine2") ?? undefined,
      addressCity: optionalString(body, "addressCity") ?? undefined,
      addressState: optionalString(body, "addressState") ?? undefined,
      addressPincode: optionalString(body, "addressPincode") ?? undefined,
    });
    return c.json(success(c, result));
  })
  .post("/enterprises/:id/settings", async (c) => {
    const { externalUserId } = requireNeonIdentity(c);
    const sql = getOwnerSqlClient(c);
    const ownerId = await resolvePlatformOwner(sql, externalUserId);
    const body = await readJsonObject(c);
    const settings = (body.settings ?? {}) as Record<string, unknown>;
    const result = await updateEnterpriseSettings(sql, ownerId, c.req.param("id"), settings);
    return c.json(success(c, result));
  })
  .post("/enterprises/:id/invoice-series", async (c) => {
    const { externalUserId } = requireNeonIdentity(c);
    const sql = getOwnerSqlClient(c);
    const ownerId = await resolvePlatformOwner(sql, externalUserId);
    const body = await readJsonObject(c);
    const result = await updateEnterpriseInvoiceSeries(sql, ownerId, c.req.param("id"), {
      prefix: optionalString(body, "prefix") ?? undefined,
      finYear: optionalString(body, "finYear") ?? undefined,
    });
    return c.json(success(c, result));
  })
  .post("/enterprises/:id/godowns", async (c) => {
    const { externalUserId } = requireNeonIdentity(c);
    const sql = getOwnerSqlClient(c);
    const ownerId = await resolvePlatformOwner(sql, externalUserId);
    const body = await readJsonObject(c);
    const godowns = Array.isArray(body.godowns) ? (body.godowns as GodownInput[]) : [];
    const result = await upsertEnterpriseGodowns(sql, ownerId, c.req.param("id"), godowns);
    return c.json(success(c, result));
  })
  .post("/enterprises/:id/dues-bands", async (c) => {
    const { externalUserId } = requireNeonIdentity(c);
    const sql = getOwnerSqlClient(c);
    const ownerId = await resolvePlatformOwner(sql, externalUserId);
    const body = await readJsonObject(c);
    const bands = Array.isArray(body.bands) ? (body.bands as DuesBandInput[]) : [];
    const result = await updateEnterpriseDuesBands(sql, ownerId, c.req.param("id"), bands);
    return c.json(success(c, result));
  })
  .get("/enterprises/:id/charges", async (c) => {
    const { externalUserId } = requireNeonIdentity(c);
    const sql = getOwnerSqlClient(c);
    await resolvePlatformOwner(sql, externalUserId);
    return c.json(success(c, { charges: await listEnterpriseCharges(sql, c.req.param("id")) }));
  })
  .post("/enterprises/:id/enforcement", async (c) => {
    const { externalUserId } = requireNeonIdentity(c);
    const sql = getOwnerSqlClient(c);
    const ownerId = await resolvePlatformOwner(sql, externalUserId);
    const body = await readJsonObject(c);
    const result = await setEnterpriseEnforcement(sql, ownerId, c.req.param("id"), body.enforced === true);
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
