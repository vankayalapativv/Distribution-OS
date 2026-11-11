import type { R2Bucket } from "@cloudflare/workers-types";
import { Hono } from "hono";
import { success } from "../lib/api-response";
import { requireCapability, requireRole } from "../lib/authz";
import { actorOf, logAudit } from "../services/audit";
import { getSqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";
import {
  optionalNumber,
  optionalString,
  readJsonObject,
  requiredString,
} from "../lib/request-body";
import {
  createExpenditure,
  createExpenditureCategory,
  deleteExpenditure,
  getExpenditureBill,
  getExpenditureById,
  getExpenditureSummary,
  listExpenditureCategories,
  listExpenditurePeople,
  listExpenditures,
  updateExpenditure,
  uploadExpenditureBill,
  EXPENDITURE_TYPES,
  type ExpenditureInput,
  type ExpenditureType,
} from "../services/expenditures";
import type { ApiEnv, Role } from "../types";

/** All three office roles record and edit expenditures (decided 2026-07-24). */
const OFFICE_ROLES: Role[] = ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"];

function requireBucket(bucket: R2Bucket | undefined): R2Bucket {
  if (!bucket) {
    throw new ApiError("STORAGE_NOT_CONFIGURED", "File storage is not configured.", 500);
  }
  return bucket;
}

function readEntryInput(body: Record<string, unknown>): ExpenditureInput {
  const amount = optionalNumber(body, "amount");
  return {
    expenditureDate: requiredString(body, "expenditureDate"),
    categoryId: requiredString(body, "categoryId"),
    amount: amount ?? 0,
    paymentMode: optionalString(body, "paymentMode"),
    paidTo: optionalString(body, "paidTo"),
    userId: optionalString(body, "userId"),
    remarks: optionalString(body, "remarks"),
    // Idempotency key for create (ignored on update) — a retried save with the
    // same value returns the existing expenditure instead of a duplicate.
    clientUuid: optionalString(body, "clientUuid"),
  };
}

export const expendituresRoutes = new Hono<ApiEnv>()
  // Static paths first so they aren't swallowed by /:id.
  .get("/categories", async (c) => {
    requireRole(c, OFFICE_ROLES);
    const categories = await listExpenditureCategories(getSqlClient(c));
    return c.json(success(c, { categories }));
  })

  .post("/categories", async (c) => {
    const auth = await requireCapability(c, "action:expenditures.manage", ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"]);
    const body = await readJsonObject(c);
    const type = requiredString(body, "type");
    if (!(EXPENDITURE_TYPES as readonly string[]).includes(type)) {
      throw new ApiError("VALIDATION", "Type must be compulsory or variable.", 422);
    }
    const sql = getSqlClient(c);
    const category = await createExpenditureCategory(
      sql,
      { userId: auth.userId! },
      { name: requiredString(body, "name"), type: type as ExpenditureType },
    );
    await logAudit(sql, actorOf(auth), {
      action: "expenditure_category.create",
      entityType: "expenditure_category",
      entityId: category.id,
      entityLabel: category.name,
      summary: `Added expenditure category ${category.name} (${type})`,
    });
    return c.json(success(c, category), 201);
  })

  .get("/people", async (c) => {
    requireRole(c, OFFICE_ROLES);
    const people = await listExpenditurePeople(getSqlClient(c));
    return c.json(success(c, { people }));
  })

  .get("/summary", async (c) => {
    requireRole(c, OFFICE_ROLES);
    const url = new URL(c.req.url);
    const summary = await getExpenditureSummary(getSqlClient(c), {
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
    });
    return c.json(success(c, summary));
  })

  .get("/", async (c) => {
    requireRole(c, OFFICE_ROLES);
    const url = new URL(c.req.url);
    const result = await listExpenditures(getSqlClient(c), {
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      categoryId: url.searchParams.get("categoryId"),
      type: url.searchParams.get("type"),
      userId: url.searchParams.get("userId"),
      search: url.searchParams.get("q"),
      sort: url.searchParams.get("sort"),
      dir: url.searchParams.get("dir"),
      page: Number(url.searchParams.get("page")) || 1,
      pageSize: Number(url.searchParams.get("pageSize")) || 8,
    });
    return c.json(success(c, result));
  })

  .post("/", async (c) => {
    const auth = await requireCapability(c, "action:expenditures.manage", ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"]);
    const body = await readJsonObject(c);
    const sql = getSqlClient(c);
    const expenditure = await createExpenditure(
      sql,
      { userId: auth.userId! },
      readEntryInput(body),
    );
    await logAudit(sql, actorOf(auth), {
      action: "expenditure.create",
      entityType: "expenditure",
      entityId: expenditure.id,
      entityLabel: expenditure.categoryName,
      summary: `Recorded expenditure — ${expenditure.categoryName} ₹${expenditure.amount.toLocaleString("en-IN")}`,
      metadata: { amount: expenditure.amount },
    });
    return c.json(success(c, expenditure), 201);
  })

  .get("/:id", async (c) => {
    requireRole(c, OFFICE_ROLES);
    const expenditure = await getExpenditureById(getSqlClient(c), c.req.param("id"));
    return c.json(success(c, expenditure));
  })

  .patch("/:id", async (c) => {
    const auth = await requireCapability(c, "action:expenditures.manage", ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"]);
    const body = await readJsonObject(c);
    const sql = getSqlClient(c);
    const expenditure = await updateExpenditure(sql, c.req.param("id"), readEntryInput(body));
    await logAudit(sql, actorOf(auth), {
      action: "expenditure.update",
      entityType: "expenditure",
      entityId: expenditure.id,
      entityLabel: expenditure.categoryName,
      summary: `Updated expenditure — ${expenditure.categoryName} ₹${expenditure.amount.toLocaleString("en-IN")}`,
      metadata: { amount: expenditure.amount },
    });
    return c.json(success(c, expenditure));
  })

  .delete("/:id", async (c) => {
    const auth = await requireCapability(c, "action:expenditures.manage", ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"]);
    const sql = getSqlClient(c);
    const result = await deleteExpenditure(sql, c.env.PHOTOS, c.req.param("id"));
    await logAudit(sql, actorOf(auth), {
      action: "expenditure.delete",
      entityType: "expenditure",
      entityId: c.req.param("id"),
      summary: "Deleted an expenditure entry",
    });
    return c.json(success(c, result));
  })

  .post("/:id/bill", async (c) => {
    const auth = await requireCapability(c, "action:expenditures.manage", ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"]);
    const bucket = requireBucket(c.env.PHOTOS);
    const form = await c.req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new ApiError("VALIDATION", "Attach the bill as the 'file' form field.", 422);
    }
    const sql = getSqlClient(c);
    const result = await uploadExpenditureBill(sql, bucket, c.req.param("id"), file);
    await logAudit(sql, actorOf(auth), {
      action: "expenditure.bill",
      entityType: "expenditure",
      entityId: c.req.param("id"),
      summary: "Uploaded a bill for an expenditure",
    });
    return c.json(success(c, result), 201);
  })

  .get("/:id/bill", async (c) => {
    requireRole(c, OFFICE_ROLES);
    const bucket = requireBucket(c.env.PHOTOS);
    const { body, contentType } = await getExpenditureBill(
      getSqlClient(c),
      bucket,
      c.req.param("id"),
    );
    return new Response(body, {
      headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=300" },
    });
  });
