import type { R2Bucket } from "@cloudflare/workers-types";
import { Hono } from "hono";
import { success } from "../lib/api-response";
import { ApiError } from "../lib/errors";
import { requireRole } from "../lib/authz";
import { getSqlClient } from "../lib/db";
import { actorOf, logAudit } from "../services/audit";
import {
  createSalesReturn,
  updateSalesReturn,
  getSalesReturnForEdit,
  getSalesReturnProof,
  type SalesReturnItemInput,
} from "../services/sales-returns";
import { notifyReorder } from "../lib/reorder-notify";
import { keysForInvoice } from "../services/stock-reorder";
import type { ApiEnv } from "../types";

// Sales returns are recorded by the collection reviewers only.
const RETURN_ROLES = ["SUPER_ADMIN", "ACCOUNTANT"] as const;

function requireBucket(c: { env: { PHOTOS?: R2Bucket } }): R2Bucket {
  if (!c.env.PHOTOS) {
    throw new ApiError("STORAGE_NOT_CONFIGURED", "File storage is not configured.", 500);
  }
  return c.env.PHOTOS;
}

export const salesReturnsRoutes = new Hono<ApiEnv>()
  .post("/", async (c) => {
    const auth = requireRole(c, [...RETURN_ROLES]);
    const form = await c.req.formData();

    const customerId = String(form.get("customerId") ?? "").trim();
    const invoiceId = String(form.get("invoiceId") ?? "").trim();
    if (!customerId || !invoiceId) {
      throw new ApiError("INVALID_FIELD", "customerId and invoiceId are required.", 422);
    }

    let items: SalesReturnItemInput[] = [];
    const rawItems = form.get("items");
    if (typeof rawItems === "string" && rawItems.length > 0) {
      try {
        const parsed = JSON.parse(rawItems);
        if (Array.isArray(parsed)) items = parsed as SalesReturnItemInput[];
      } catch {
        throw new ApiError("INVALID_FIELD", "items must be valid JSON.", 422);
      }
    }

    const file = form.get("file");
    const proof = file instanceof File && file.size > 0 ? file : null;
    if (proof && proof.size > 10 * 1024 * 1024) {
      throw new ApiError("INVALID_FIELD", "Proof file must be under 10 MB.", 422);
    }
    const bucket = proof ? requireBucket(c) : null;

    const returnDate = String(form.get("returnDate") ?? "").trim() || null;
    const reason = String(form.get("reason") ?? "").trim() || null;

    const sql = getSqlClient(c);
    const result = await createSalesReturn(
      sql,
      bucket,
      { userId: auth.userId! },
      customerId,
      { invoiceId, returnDate, reason, items },
      proof,
    );
    await logAudit(sql, actorOf(auth), {
      action: "sales_return.create",
      entityType: "sales_return",
      entityId: result.id,
      entityLabel: result.invoiceNumber,
      summary: `Recorded sales return against ${result.invoiceNumber} — ₹${result.grossAmount.toLocaleString("en-IN")} (${result.itemCount} item${result.itemCount === 1 ? "" : "s"})`,
      metadata: { grossAmount: result.grossAmount, itemCount: result.itemCount },
    });
    // Restock credits stock back → a low SKU may recover above reorder and auto-close.
    await notifyReorder(c, sql, await keysForInvoice(sql, result.invoiceId));
    return c.json(success(c, { salesReturn: result }), 201);
  })

  // Return detail for the edit dialog — header + returnable lines (this return's
  // units freed) + its current quantities.
  .get("/:id", async (c) => {
    requireRole(c, [...RETURN_ROLES]);
    const salesReturn = await getSalesReturnForEdit(getSqlClient(c), c.req.param("id"));
    return c.json(success(c, { salesReturn }));
  })

  // Edit a sales return — full re-entry of returned quantities (SUPER_ADMIN).
  .patch("/:id", async (c) => {
    const auth = requireRole(c, ["SUPER_ADMIN"]);
    const form = await c.req.formData();

    let items: SalesReturnItemInput[] = [];
    const rawItems = form.get("items");
    if (typeof rawItems === "string" && rawItems.length > 0) {
      try {
        const parsed = JSON.parse(rawItems);
        if (Array.isArray(parsed)) items = parsed as SalesReturnItemInput[];
      } catch {
        throw new ApiError("INVALID_FIELD", "items must be valid JSON.", 422);
      }
    }

    const file = form.get("file");
    const proof = file instanceof File && file.size > 0 ? file : null;
    if (proof && proof.size > 10 * 1024 * 1024) {
      throw new ApiError("INVALID_FIELD", "Proof file must be under 10 MB.", 422);
    }
    const bucket = proof ? requireBucket(c) : null;

    const returnDate = String(form.get("returnDate") ?? "").trim() || null;
    const reason = String(form.get("reason") ?? "").trim() || null;

    const sql = getSqlClient(c);
    const result = await updateSalesReturn(
      sql,
      bucket,
      { userId: auth.userId! },
      c.req.param("id"),
      { returnDate, reason, items },
      proof,
    );
    await logAudit(sql, actorOf(auth), {
      action: "sales_return.update",
      entityType: "sales_return",
      entityId: result.id,
      entityLabel: result.invoiceNumber,
      summary: `Edited sales return against ${result.invoiceNumber} — ₹${result.grossAmount.toLocaleString("en-IN")} (${result.itemCount} item${result.itemCount === 1 ? "" : "s"})`,
      metadata: { grossAmount: result.grossAmount, itemCount: result.itemCount },
    });
    // Editing a return re-applies restock → re-check the invoice's SKUs for recovery.
    await notifyReorder(c, sql, await keysForInvoice(sql, result.invoiceId));
    return c.json(success(c, { salesReturn: result }));
  })

  .get("/:id/proof", async (c) => {
    requireRole(c, [...RETURN_ROLES]);
    const bucket = requireBucket(c);
    const { body, contentType } = await getSalesReturnProof(
      getSqlClient(c),
      bucket,
      c.req.param("id"),
    );
    return new Response(body, {
      headers: { "Content-Type": contentType, "Content-Disposition": "inline" },
    });
  });
