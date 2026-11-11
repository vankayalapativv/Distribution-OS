import { waitUntilSafe } from "../lib/wait-until";
import { Hono } from "hono";
import { success } from "../lib/api-response";
import { requireAuth, requireCapability, requireRole } from "../lib/authz";
import { actorOf, logAudit } from "../services/audit";
import { getSqlClient } from "../lib/db";
import {
  getInvoice,
  listInvoices,
  sendExpoPush,
} from "../services/invoices";
import { getReturnableInvoice } from "../services/sales-returns";
import { cancelInvoice, editGeneratedInvoice, generateInvoice, getGeneratedInvoiceForEdit, getInvoiceItems, getInvoicePdfBytes, getInvoicePdfData, getNextInvoiceNumberPreview, type GenerateLineInput } from "../services/invoicing";
import { getInvoiceExport } from "../services/invoice-gst-export";
import { notifyReorder } from "../lib/reorder-notify";
import { keysForInvoice } from "../services/stock-reorder";
import { readJsonObject, requiredString } from "../lib/request-body";
import type { ApiEnv } from "../types";

// Reads are gated by sectionGuard("invoices") at the mount, so a MANAGER only
// reaches these if SA granted them the Invoices section. Include MANAGER here so
// the handler's own role check doesn't re-block a granted Manager.
const OFFICE_ROLES = ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"] as const;

export const invoicesRoutes = new Hono<ApiEnv>()
  .get("/", async (c) => {
    requireRole(c, [...OFFICE_ROLES]);
    const page = Math.max(1, Number(c.req.query("page")) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(c.req.query("pageSize")) || 8));
    const result = await listInvoices(getSqlClient(c), {
      q: c.req.query("q")?.trim() || null,
      customerId: c.req.query("customerId")?.trim() || null,
      sort: c.req.query("sort")?.trim() || null,
      dir: c.req.query("dir")?.trim() || null,
      page,
      pageSize,
    });
    return c.json(success(c, result));
  })

  // GSTR-1-ready register for the CA (data; the web builds the .xlsx). Registered
  // before /:id so "export" isn't read as an invoice id.
  .get("/export", async (c) => {
    requireRole(c, ["SUPER_ADMIN", "ACCOUNTANT"]);
    const data = await getInvoiceExport(getSqlClient(c), c.req.query("from") ?? "", c.req.query("to") ?? "");
    return c.json(success(c, data));
  })

  // Provisional preview of the number the next generated invoice will get —
  // peeks the series without consuming it. Registered before /:id so
  // "next-number" isn't read as an invoice id. SUPER_ADMIN + ACCOUNTANT (the
  // invoice creators).
  .get("/next-number", async (c) => {
    requireRole(c, ["SUPER_ADMIN", "ACCOUNTANT"]);
    const preview = await getNextInvoiceNumberPreview(getSqlClient(c));
    return c.json(success(c, preview));
  })

  .get("/:id", async (c) => {
    requireRole(c, [...OFFICE_ROLES]);
    const sql = getSqlClient(c);
    const invoice = await getInvoice(sql, c.req.param("id"));
    // Generated invoices carry structured line items (uploaded ones use line_items jsonb).
    const items = await getInvoiceItems(sql, c.req.param("id"));
    return c.json(success(c, { invoice, items }));
  })

  // Self-contained payload for rendering a generated invoice's PDF client-side.
  .get("/:id/pdf-data", async (c) => {
    requireRole(c, [...OFFICE_ROLES]);
    const data = await getInvoicePdfData(getSqlClient(c), c.req.param("id"));
    return c.json(success(c, data));
  })

  // Invoice lines that can still be returned (billed − already returned) — feeds
  // the Sales Return picker on the customer ledger page.
  .get("/:id/returnable", async (c) => {
    requireRole(c, [...OFFICE_ROLES]);
    const result = await getReturnableInvoice(getSqlClient(c), c.req.param("id"));
    return c.json(success(c, result));
  })

  // Generate a GST tax invoice in-system (allocates number, splits CGST/SGST or
  // IGST at 18%, deducts stock — hard-blocked on short stock). SUPER_ADMIN + ACCOUNTANT.
  .post("/generate", async (c) => {
    const auth = await requireCapability(c, "action:invoices.generate", ["SUPER_ADMIN", "ACCOUNTANT"]);
    const body = await readJsonObject(c);
    const sql = getSqlClient(c);
    const num = (v: unknown) => Number(v);
    const sOrNull = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    const numOrNull = (v: unknown) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
    const lines: GenerateLineInput[] = (Array.isArray(body.lines) ? body.lines : [])
      .map((x: Record<string, unknown>) => ({
        productId: String(x.productId ?? ""),
        packSizeLitres: num(x.packSizeLitres),
        brand: sOrNull(x.brand),
        segment: sOrNull(x.segment),
        hsnCode: sOrNull(x.hsnCode),
        qtyUnits: num(x.qtyUnits),
        rate: num(x.rate),
        mrp: numOrNull(x.mrp),
        discountPct: num(x.discountPct) || 0,
        orderItemId: sOrNull(x.orderItemId),
      }))
      .filter((l: GenerateLineInput) => l.productId && l.packSizeLitres > 0 && l.qtyUnits > 0);

    const invoiceLocationId = requiredString(body, "locationId");
    const invoice = await generateInvoice(sql, auth.userId!, {
      customerId: requiredString(body, "customerId"),
      locationId: invoiceLocationId,
      invoiceDate: requiredString(body, "invoiceDate"),
      orderId: sOrNull(body.orderId),
      placeOfSupply: sOrNull(body.placeOfSupply),
      irn: sOrNull(body.irn),
      ewayBillNo: sOrNull(body.ewayBillNo),
      reverseCharge: body.reverseCharge === true || body.reverseCharge === "true",
      transport: sOrNull(body.transport),
      vehicleNo: sOrNull(body.vehicleNo),
      grRrNo: sOrNull(body.grRrNo),
      station: sOrNull(body.station),
      transportCharge: Math.max(0, num(body.transportCharge) || 0),
      lines,
    });
    await logAudit(sql, actorOf(auth), {
      action: "invoice.generate",
      entityType: "invoice",
      entityId: invoice.id,
      entityLabel: invoice.invoiceNumber,
      summary: `Generated invoice ${invoice.invoiceNumber} for ${invoice.customerName} — ₹${invoice.grandTotal.toLocaleString("en-IN")}`,
      metadata: { grandTotal: invoice.grandTotal },
    });
    // Notify the attributed SE (parity with upload). Best-effort, off the response.
    waitUntilSafe(c,
      sendExpoPush(invoice.push.tokens, invoice.push.title, invoice.push.body, {
        type: "invoice",
        invoiceId: invoice.id,
      }),
    );
    // The sale deducts stock (FEFO) → a SKU may cross its reorder level.
    await notifyReorder(c, sql, lines.map((l) => ({ locationId: invoiceLocationId, productId: l.productId, packSizeLitres: l.packSizeLitres })));
    return c.json(success(c, { invoice }), 201);
  })

  // Prefill payload for editing a generated invoice (header + form-shaped lines).
  .get("/:id/edit-data", async (c) => {
    requireRole(c, ["SUPER_ADMIN", "ACCOUNTANT"]);
    const data = await getGeneratedInvoiceForEdit(getSqlClient(c), c.req.param("id"));
    return c.json(success(c, data));
  })

  // Edit a generated invoice in place (same number). Header fields are free; line
  // changes reverse + re-apply stock and recompute totals. SUPER_ADMIN + ACCOUNTANT.
  .patch("/:id/generated", async (c) => {
    const auth = await requireCapability(c, "action:invoices.generate", ["SUPER_ADMIN", "ACCOUNTANT"]);
    const body = await readJsonObject(c);
    const sql = getSqlClient(c);
    const num = (v: unknown) => Number(v);
    const sOrNull = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    const numOrNull = (v: unknown) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
    const lines: GenerateLineInput[] = (Array.isArray(body.lines) ? body.lines : [])
      .map((x: Record<string, unknown>) => ({
        productId: String(x.productId ?? ""),
        packSizeLitres: num(x.packSizeLitres),
        brand: sOrNull(x.brand),
        segment: sOrNull(x.segment),
        hsnCode: sOrNull(x.hsnCode),
        qtyUnits: num(x.qtyUnits),
        rate: num(x.rate),
        mrp: numOrNull(x.mrp),
        discountPct: num(x.discountPct) || 0,
        orderItemId: sOrNull(x.orderItemId),
      }))
      .filter((l: GenerateLineInput) => l.productId && l.packSizeLitres > 0 && l.qtyUnits > 0);

    const invoice = await editGeneratedInvoice(sql, auth.userId!, c.req.param("id"), {
      invoiceDate: requiredString(body, "invoiceDate"),
      placeOfSupply: sOrNull(body.placeOfSupply),
      irn: sOrNull(body.irn),
      ewayBillNo: sOrNull(body.ewayBillNo),
      reverseCharge: body.reverseCharge === true || body.reverseCharge === "true",
      transport: sOrNull(body.transport),
      vehicleNo: sOrNull(body.vehicleNo),
      grRrNo: sOrNull(body.grRrNo),
      station: sOrNull(body.station),
      transportCharge: Math.max(0, num(body.transportCharge) || 0),
      lines,
    });
    await logAudit(sql, actorOf(auth), {
      action: "invoice.edit",
      entityType: "invoice",
      entityId: invoice.id,
      entityLabel: invoice.invoiceNumber,
      summary: `Edited invoice ${invoice.invoiceNumber} for ${invoice.customerName} — ₹${invoice.grandTotal.toLocaleString("en-IN")}`,
      metadata: { grandTotal: invoice.grandTotal },
    });
    // Line edits reverse & re-apply stock → re-check every SKU the invoice touched.
    await notifyReorder(c, sql, await keysForInvoice(sql, invoice.id));
    return c.json(success(c, { invoice }));
  })

  // Cancel a generated invoice — reverses its stock and re-opens any linked order.
  .post("/:id/cancel", async (c) => {
    const auth = await requireCapability(c, "action:invoices.generate", ["SUPER_ADMIN", "ACCOUNTANT"]);
    const body = await readJsonObject(c);
    const sql = getSqlClient(c);
    const result = await cancelInvoice(sql, auth.userId!, c.req.param("id"), requiredString(body, "reason"));
    await logAudit(sql, actorOf(auth), {
      action: "invoice.cancel",
      entityType: "invoice",
      entityId: result.id,
      entityLabel: result.invoiceNumber,
      summary: `Cancelled invoice ${result.invoiceNumber}`,
    });
    // Cancelling credits stock back → may lift a SKU above reorder and auto-close its alert.
    await notifyReorder(c, sql, await keysForInvoice(sql, result.id));
    return c.json(success(c, { invoice: result }));
  });

/** Renders the invoice PDF on demand from its data — office roles, or the SE the
 *  invoice belongs to. No stored copy; the document is always current. */
export const invoiceFilesRoutes = new Hono<ApiEnv>().get("/:id", async (c) => {
  const auth = requireAuth(c);
  const { bytes, fileName } = await getInvoicePdfBytes(
    getSqlClient(c),
    { userId: auth.userId!, role: auth.role ?? null },
    c.req.param("id"),
  );
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
    },
  });
});
