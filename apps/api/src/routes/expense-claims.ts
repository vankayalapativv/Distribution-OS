import type { R2Bucket } from "@cloudflare/workers-types";
import { Hono } from "hono";
import { success } from "../lib/api-response";
import { requireAuth, requireCapability, requireRole } from "../lib/authz";
import { actorOf, logAudit } from "../services/audit";
import { getSqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";
import { optionalNumber, optionalString, readJsonObject, requiredString } from "../lib/request-body";
import {
  approveClaim,
  getClaim,
  listClaimCategories,
  listClaims,
  rejectClaim,
  resubmitClaim,
  submitClaim,
  type ClaimInput,
} from "../services/expense-claims";
import { getExpenditureBill, uploadExpenditureBill } from "../services/expenditures";
import type { ApiEnv, Role } from "../types";

const FIELD_ROLES: Role[] = ["SALES_EXECUTIVE", "LOGISTICS"];
const OFFICE_ROLES: Role[] = ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"];
const APPROVE = "action:expenditures.claims.approve";

function requireBucket(bucket: R2Bucket | undefined): R2Bucket {
  if (!bucket) throw new ApiError("STORAGE_NOT_CONFIGURED", "File storage is not configured.", 500);
  return bucket;
}

function claimFromForm(form: FormData): ClaimInput {
  const amount = Number(form.get("amount"));
  return {
    categoryId: String(form.get("categoryId") ?? ""),
    amount: Number.isFinite(amount) ? amount : 0,
    expenditureDate: String(form.get("expenditureDate") ?? ""),
    remarks: (form.get("remarks") as string | null) || null,
    clientUuid: (form.get("clientUuid") as string | null) || null,
  };
}

export const expenseClaimsRoutes = new Hono<ApiEnv>()
  // Field: submit a claim with its REQUIRED receipt (one multipart request).
  .post("/", async (c) => {
    const auth = requireRole(c, FIELD_ROLES);
    const bucket = requireBucket(c.env.PHOTOS);
    const form = await c.req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new ApiError("VALIDATION", "Attach the receipt photo as the 'file' field.", 422);
    }
    const sql = getSqlClient(c);
    const claim = await submitClaim(sql, auth.userId!, claimFromForm(form!));
    const withReceipt = await uploadExpenditureBill(sql, bucket, claim.id, file)
      .then(() => getClaim(sql, claim.id));
    await logAudit(sql, actorOf(auth), {
      action: "expense_claim.submit",
      entityType: "expenditure",
      entityId: claim.id,
      entityLabel: claim.categoryName,
      summary: `Submitted a ${claim.categoryName} claim — ₹${claim.amount.toLocaleString("en-IN")}`,
    });
    return c.json(success(c, withReceipt), 201);
  })

  // Field: the categories a claim can be filed under (active + variable).
  .get("/categories", async (c) => {
    requireRole(c, FIELD_ROLES);
    return c.json(success(c, await listClaimCategories(getSqlClient(c))));
  })

  // Field: my own claims (any status).
  .get("/mine", async (c) => {
    const auth = requireRole(c, FIELD_ROLES);
    return c.json(success(c, await listClaims(getSqlClient(c), { submittedBy: auth.userId! })));
  })

  // Field: edit a rejected claim and resubmit (keeps the existing receipt).
  .post("/:id/resubmit", async (c) => {
    const auth = requireRole(c, FIELD_ROLES);
    const body = await readJsonObject(c);
    const input: ClaimInput = {
      categoryId: requiredString(body, "categoryId"),
      amount: optionalNumber(body, "amount") ?? 0,
      expenditureDate: requiredString(body, "expenditureDate"),
      remarks: optionalString(body, "remarks"),
    };
    const claim = await resubmitClaim(getSqlClient(c), auth.userId!, c.req.param("id"), input);
    return c.json(success(c, claim));
  })

  // Office: the review queue (default = pending).
  .get("/", async (c) => {
    requireRole(c, OFFICE_ROLES);
    const status = c.req.query("status") ?? "submitted";
    return c.json(success(c, await listClaims(getSqlClient(c), { status })));
  })

  .get("/:id", async (c) => {
    const auth = requireAuth(c);
    const claim = await getClaim(getSqlClient(c), c.req.param("id"));
    // A field user may only read their own claim; office roles read any.
    if (!OFFICE_ROLES.includes(auth.role!) && claim.submittedBy !== auth.userId) {
      throw new ApiError("NOT_FOUND", "Claim not found.", 404);
    }
    return c.json(success(c, claim));
  })

  // Office: approve (optionally reduced) AND reimburse in one step — gated by the
  // claims.approve permission. The payment mode is required (it's the reimbursement).
  .post("/:id/approve", async (c) => {
    const auth = await requireCapability(c, APPROVE, OFFICE_ROLES);
    const body = await readJsonObject(c).catch(() => ({}));
    const sql = getSqlClient(c);
    const claim = await approveClaim(sql, auth.userId!, c.req.param("id"), optionalNumber(body, "approvedAmount"), optionalString(body, "paymentMode"));
    await logAudit(sql, actorOf(auth), {
      action: "expense_claim.approve",
      entityType: "expenditure",
      entityId: claim.id,
      entityLabel: claim.categoryName,
      summary: `Approved + reimbursed a claim — ₹${claim.amount.toLocaleString("en-IN")}`,
      metadata: { amount: claim.amount },
    });
    return c.json(success(c, claim));
  })

  // Office: reject with a reason — gated by the claims.approve permission.
  .post("/:id/reject", async (c) => {
    const auth = await requireCapability(c, APPROVE, OFFICE_ROLES);
    const body = await readJsonObject(c);
    const sql = getSqlClient(c);
    const claim = await rejectClaim(sql, auth.userId!, c.req.param("id"), requiredString(body, "reason"));
    await logAudit(sql, actorOf(auth), {
      action: "expense_claim.reject",
      entityType: "expenditure",
      entityId: claim.id,
      summary: "Rejected a claim",
    });
    return c.json(success(c, claim));
  })

  // Receipt image — office roles, or the claim's own submitter.
  .get("/:id/bill", async (c) => {
    const auth = requireAuth(c);
    const sql = getSqlClient(c);
    const claim = await getClaim(sql, c.req.param("id"));
    if (!OFFICE_ROLES.includes(auth.role!) && claim.submittedBy !== auth.userId) {
      throw new ApiError("NOT_FOUND", "Claim not found.", 404);
    }
    const { body, contentType } = await getExpenditureBill(sql, requireBucket(c.env.PHOTOS), claim.id);
    return new Response(body, {
      headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=300" },
    });
  });
