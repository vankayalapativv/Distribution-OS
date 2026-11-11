import { Hono } from "hono";
import { success } from "../lib/api-response";
import { ApiError } from "../lib/errors";
import { requireCapability, requireRole } from "../lib/authz";
import { getSqlClient } from "../lib/db";
import { readJsonObject, requiredString } from "../lib/request-body";
import { actorOf, logAudit } from "../services/audit";
import { createLocation, listLocations, renameLocation, updateLocation } from "../services/stock-locations";
import {
  balancesByGodown,
  balancesSummary,
  getAdjustment,
  getBalancesForSkus,
  getGrn,
  listNearExpiry,
  lookupProductStock,
  getInvoiceStockLots,
  getTransfer,
  listAdjustments,
  listAvailableLots,
  listBalances,
  listGrns,
  listInvoiceStockActivity,
  listMovements,
  listSkus,
  listTransfers,
  postAdjustment,
  postGrn,
  postOpening,
  postTransfer,
  recomputeBalances,
  setReorderLevel,
} from "../services/stock";
import { notifyReorder } from "../lib/reorder-notify";
import type { ReorderKey } from "../services/stock-reorder";
import type { ApiEnv } from "../types";

const OFFICE = ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"] as const;
const WRITE = ["SUPER_ADMIN", "MANAGER"] as const;

type Raw = Record<string, unknown>;
const asArray = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : []);
const numOrNull = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const strOrNull = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
/** A raw id field as a string without stringifying a non-string (avoids "[object Object]"). */
const asId = (v: unknown): string => (typeof v === "string" ? v : "");

/** Transfer lines — product/pack/qty + the source batch and optional dest shelf. */
function parseTransferLines(raw: unknown) {
  return asArray(raw)
    .map((x) => ({
      productId: asId(x.productId),
      packSizeLitres: Number(x.packSizeLitres),
      brand: strOrNull(x.brand),
      qtyUnits: Number(x.qtyUnits),
      fromBatchId: asId(x.fromBatchId),
      destRackNo: strOrNull(x.destRackNo),
      destShelfNo: strOrNull(x.destShelfNo),
      destBinNo: strOrNull(x.destBinNo),
    }))
    .filter((l) => l.productId && Number.isFinite(l.packSizeLitres) && l.packSizeLitres > 0 && Number.isFinite(l.qtyUnits) && l.qtyUnits > 0);
}

export const stockRoutes = new Hono<ApiEnv>()
  // ── Godowns ──
  .get("/locations", async (c) => {
    requireRole(c, [...OFFICE]);
    const locations = await listLocations(getSqlClient(c), { activeOnly: c.req.query("activeOnly") === "1" });
    return c.json(success(c, { locations }));
  })
  .post("/locations", async (c) => {
    const auth = await requireCapability(c, "action:stock.manage", [...WRITE]);
    const body = await readJsonObject(c);
    const sql = getSqlClient(c);
    const location = await createLocation(sql, auth.userId!, {
      name: requiredString(body, "name"),
      code: strOrNull(body.code),
      city: strOrNull(body.city),
      state: strOrNull(body.state),
      stateCode: strOrNull(body.stateCode),
      pincode: strOrNull(body.pincode),
      isDefault: body.isDefault === true,
    });
    await logAudit(sql, actorOf(auth), { action: "stock.location.create", entityType: "stock_location", entityId: location.id, entityLabel: location.name, summary: `Added godown ${location.name}` });
    return c.json(success(c, { location }), 201);
  })
  // Rename only (Settings → Company godown list). Separate from the full-field
  // PATCH below so it can't clobber code/city/pincode/default.
  .patch("/locations/:id/rename", async (c) => {
    const auth = await requireCapability(c, "action:stock.manage", [...WRITE]);
    const sql = getSqlClient(c);
    const body = await readJsonObject(c);
    const location = await renameLocation(sql, c.req.param("id"), requiredString(body, "name"));
    await logAudit(sql, actorOf(auth), { action: "stock.location.rename", entityType: "stock_location", entityId: location.id, entityLabel: location.name, summary: `Renamed godown to ${location.name}` });
    return c.json(success(c, { location }));
  })
  .patch("/locations/:id", async (c) => {
    await requireCapability(c, "action:stock.manage", [...WRITE]);
    const body = await readJsonObject(c);
    const location = await updateLocation(getSqlClient(c), c.req.param("id"), {
      name: requiredString(body, "name"),
      code: strOrNull(body.code),
      city: strOrNull(body.city),
      state: strOrNull(body.state),
      stateCode: strOrNull(body.stateCode),
      pincode: strOrNull(body.pincode),
      isDefault: body.isDefault === true,
    });
    return c.json(success(c, { location }));
  })

  // ── Catalogue SKUs (product × pack) ──
  .get("/skus", async (c) => {
    requireRole(c, [...OFFICE]);
    const skus = await listSkus(getSqlClient(c), { search: c.req.query("search") ?? null, brand: c.req.query("brand") ?? null });
    return c.json(success(c, { skus }));
  })

  // ── Balances (the Balances tab) ──
  .get("/balances", async (c) => {
    requireRole(c, [...OFFICE]);
    const result = await listBalances(getSqlClient(c), {
      locationId: c.req.query("locationId") ?? null,
      search: c.req.query("search") ?? null,
      lowOnly: c.req.query("lowOnly") === "1",
      page: numOrNull(c.req.query("page")),
      pageSize: numOrNull(c.req.query("pageSize")),
    });
    return c.json(success(c, result));
  })

  // ── Balances KPIs (Balances-tab summary header) ──
  .get("/balances/summary", async (c) => {
    requireRole(c, [...OFFICE]);
    const summary = await balancesSummary(getSqlClient(c), { locationId: c.req.query("locationId") ?? null });
    return c.json(success(c, summary));
  })

  // ── On-hand for a specific set of SKUs at one godown (New-Invoice per-line
  //    stock check). `skus` = comma list of productId:packSizeLitres. ──
  .get("/balances/for-skus", async (c) => {
    requireRole(c, [...OFFICE]);
    const locationId = strOrNull(c.req.query("locationId"));
    if (!locationId) throw new ApiError("INVALID_FIELD", "A godown is required.", 422);
    const skus = (c.req.query("skus") ?? "")
      .split(",")
      .map((pair) => {
        const [productId, pack] = pair.split(":");
        return { productId: String(productId ?? ""), packSizeLitres: Number(pack) };
      })
      .filter((s) => s.productId && Number.isFinite(s.packSizeLitres) && s.packSizeLitres > 0);
    const have = await getBalancesForSkus(getSqlClient(c), locationId, skus);
    const balances = skus.map((s) => ({
      productId: s.productId,
      packSizeLitres: s.packSizeLitres,
      qtyUnits: have.get(`${s.productId}|${s.packSizeLitres}`) ?? 0,
    }));
    return c.json(success(c, { balances }));
  })

  // ── Movement ledger (the Movements tab) ──
  .get("/movements", async (c) => {
    requireRole(c, [...OFFICE]);
    const result = await listMovements(getSqlClient(c), {
      locationId: c.req.query("locationId") ?? null,
      productId: c.req.query("productId") ?? null,
      kind: c.req.query("kind") ?? null,
      page: numOrNull(c.req.query("page")),
      pageSize: numOrNull(c.req.query("pageSize")),
    });
    return c.json(success(c, result));
  })

  // ── Document lists (GRN / Transfers / Adjustments tabs) ──
  .get("/grn", async (c) => {
    requireRole(c, [...OFFICE]);
    const result = await listGrns(getSqlClient(c), { locationId: c.req.query("locationId") ?? null, page: numOrNull(c.req.query("page")), pageSize: numOrNull(c.req.query("pageSize")) });
    return c.json(success(c, result));
  })
  // Advisory FEFO: received batches nearing expiry, soonest first (optional
  // godown + within-days filter). Office roles.
  .get("/near-expiry", async (c) => {
    requireRole(c, [...OFFICE]);
    const rows = await listNearExpiry(getSqlClient(c), {
      locationId: c.req.query("locationId") ?? null,
      withinDays: numOrNull(c.req.query("withinDays")),
    });
    return c.json(success(c, { rows }));
  })

  // ── Per-godown on-hand breakdown (stat-card drill-downs) ──
  .get("/summary/by-godown", async (c) => {
    requireRole(c, [...OFFICE]);
    const rows = await balancesByGodown(getSqlClient(c));
    return c.json(success(c, { rows }));
  })

  // ── Stock lookup: on-hand per godown + batches + recent movements for one product ──
  .get("/lookup", async (c) => {
    requireRole(c, [...OFFICE]);
    const productId = c.req.query("productId");
    if (!productId) throw new ApiError("INVALID_FIELD", "productId is required.", 422);
    const lookup = await lookupProductStock(getSqlClient(c), productId);
    return c.json(success(c, { lookup }));
  })

  // ── Available batch lots for one SKU at one godown (Transfer/Adjust pickers) ──
  .get("/lots", async (c) => {
    requireRole(c, [...OFFICE]);
    const locationId = c.req.query("locationId");
    const productId = c.req.query("productId");
    if (!locationId || !productId) throw new ApiError("INVALID_FIELD", "locationId and productId are required.", 422);
    const lots = await listAvailableLots(getSqlClient(c), { locationId, productId, packSizeLitres: numOrNull(c.req.query("packSizeLitres")) });
    return c.json(success(c, { lots }));
  })

  // ── Invoice stock events (sales + reversals) for the Recent-activity feed ──
  .get("/invoice-activity", async (c) => {
    requireRole(c, [...OFFICE]);
    const rows = await listInvoiceStockActivity(getSqlClient(c), { locationId: c.req.query("locationId") ?? null, limit: numOrNull(c.req.query("limit")) });
    return c.json(success(c, { rows }));
  })

  // ── Per-lot breakdown of one invoice's sale/reversal/return (activity drawer) ──
  .get("/invoice-lots", async (c) => {
    requireRole(c, [...OFFICE]);
    const invoiceId = c.req.query("invoiceId");
    if (!invoiceId) throw new ApiError("INVALID_FIELD", "invoiceId is required.", 422);
    const q = c.req.query("kind");
    const kind = q === "reversal" ? "reversal" : q === "return" ? "return" : "sale";
    const detail = await getInvoiceStockLots(getSqlClient(c), invoiceId, kind);
    return c.json(success(c, { detail }));
  })
  .get("/transfers", async (c) => {
    requireRole(c, [...OFFICE]);
    const result = await listTransfers(getSqlClient(c), { locationId: c.req.query("locationId") ?? null, page: numOrNull(c.req.query("page")), pageSize: numOrNull(c.req.query("pageSize")) });
    return c.json(success(c, result));
  })
  .get("/adjustments", async (c) => {
    requireRole(c, [...OFFICE]);
    const result = await listAdjustments(getSqlClient(c), { locationId: c.req.query("locationId") ?? null, page: numOrNull(c.req.query("page")), pageSize: numOrNull(c.req.query("pageSize")) });
    return c.json(success(c, result));
  })

  // ── Single-document detail (row-click drawers) ──
  .get("/grn/:id", async (c) => {
    requireRole(c, [...OFFICE]);
    const grn = await getGrn(getSqlClient(c), c.req.param("id"));
    return c.json(success(c, { grn }));
  })
  .get("/transfers/:id", async (c) => {
    requireRole(c, [...OFFICE]);
    const transfer = await getTransfer(getSqlClient(c), c.req.param("id"));
    return c.json(success(c, { transfer }));
  })
  .get("/adjustments/:id", async (c) => {
    requireRole(c, [...OFFICE]);
    const adjustment = await getAdjustment(getSqlClient(c), c.req.param("id"));
    return c.json(success(c, { adjustment }));
  })

  // ── GRN (goods received → stock in) ──
  .post("/grn", async (c) => {
    const auth = await requireCapability(c, "action:stock.manage", [...WRITE]);
    const body = await readJsonObject(c);
    const sql = getSqlClient(c);
    const lines = asArray(body.lines)
      .map((x) => ({
        productId: asId(x.productId),
        packSizeLitres: Number(x.packSizeLitres),
        brand: strOrNull(x.brand),
        qtyUnits: Number(x.qtyUnits),
        rate: numOrNull(x.rate),
        // Optional stock-in details.
        batchNumber: strOrNull(x.batchNumber),
        expiryDate: strOrNull(x.expiryDate),
        rackNo: strOrNull(x.rackNo),
        shelfNo: strOrNull(x.shelfNo),
        binNo: strOrNull(x.binNo),
      }))
      .filter((l) => l.productId && l.packSizeLitres > 0 && Number.isFinite(l.qtyUnits) && l.qtyUnits > 0);
    const grnLocationId = requiredString(body, "locationId");
    const grn = await postGrn(sql, auth.userId!, {
      locationId: grnLocationId,
      supplierName: requiredString(body, "supplierName"),
      supplierInvoiceNo: strOrNull(body.supplierInvoiceNo),
      supplierInvoiceDate: strOrNull(body.supplierInvoiceDate),
      receivedDate: strOrNull(body.receivedDate),
      reference: strOrNull(body.reference),
      note: strOrNull(body.note),
      lines,
    });
    await logAudit(sql, actorOf(auth), { action: "stock.grn.post", entityType: "goods_receipt", entityId: grn.id, entityLabel: grn.grnNumber, summary: `Recorded ${grn.grnNumber} — ${lines.length} line(s)` });
    // Stock-in can restock a low SKU above its reorder level → auto-close its alert.
    await notifyReorder(c, sql, lines.map((l) => ({ locationId: grnLocationId, productId: l.productId, packSizeLitres: l.packSizeLitres })));
    return c.json(success(c, { grn }), 201);
  })

  // ── Inter-godown transfer ──
  .post("/transfers", async (c) => {
    const auth = await requireCapability(c, "action:stock.manage", [...WRITE]);
    const body = await readJsonObject(c);
    const sql = getSqlClient(c);
    const fromLocationId = requiredString(body, "fromLocationId");
    const toLocationId = requiredString(body, "toLocationId");
    const transferLines = parseTransferLines(body.lines);
    const transfer = await postTransfer(sql, auth.userId!, {
      fromLocationId,
      toLocationId,
      transferDate: strOrNull(body.transferDate),
      note: strOrNull(body.note),
      lines: transferLines,
    });
    await logAudit(sql, actorOf(auth), { action: "stock.transfer.post", entityType: "stock_transfer", entityId: transfer.id, entityLabel: transfer.transferNumber, summary: `Transfer ${transfer.transferNumber}` });
    // Source godown drops (may cross low); destination rises (may auto-close) — check both.
    await notifyReorder(c, sql, transferLines.flatMap((l): ReorderKey[] => [
      { locationId: fromLocationId, productId: l.productId, packSizeLitres: l.packSizeLitres },
      { locationId: toLocationId, productId: l.productId, packSizeLitres: l.packSizeLitres },
    ]));
    return c.json(success(c, { transfer }), 201);
  })

  // ── Adjustment ──
  .post("/adjustments", async (c) => {
    const auth = await requireCapability(c, "action:stock.manage", [...WRITE]);
    const body = await readJsonObject(c);
    const sql = getSqlClient(c);
    const lines = asArray(body.lines)
      .map((x) => ({
        productId: asId(x.productId),
        packSizeLitres: Number(x.packSizeLitres),
        brand: strOrNull(x.brand),
        deltaUnits: Number(x.deltaUnits),
        batchId: asId(x.batchId) || null, // negative: the lot to reduce
        batchNumber: strOrNull(x.batchNumber), // positive: the batch it creates
        expiryDate: strOrNull(x.expiryDate),
        rackNo: strOrNull(x.rackNo),
        shelfNo: strOrNull(x.shelfNo),
        binNo: strOrNull(x.binNo),
      }))
      .filter((l) => l.productId && l.packSizeLitres > 0 && Number.isFinite(l.deltaUnits));
    const adjustmentLocationId = requiredString(body, "locationId");
    const adjustment = await postAdjustment(sql, auth.userId!, {
      locationId: adjustmentLocationId,
      reason: requiredString(body, "reason"),
      note: strOrNull(body.note),
      adjustmentDate: strOrNull(body.adjustmentDate),
      lines,
    });
    await logAudit(sql, actorOf(auth), { action: "stock.adjustment.post", entityType: "stock_adjustment", entityId: adjustment.id, entityLabel: adjustment.adjustmentNumber, summary: `Adjustment ${adjustment.adjustmentNumber}` });
    // A negative adjustment can cross low; a positive one can restock → check both ways.
    await notifyReorder(c, sql, lines.map((l) => ({ locationId: adjustmentLocationId, productId: l.productId, packSizeLitres: l.packSizeLitres })));
    return c.json(success(c, { adjustment }), 201);
  })

  // ── Opening stock (seed at go-live; CSV or screen both post here) ──
  .post("/opening", async (c) => {
    const auth = await requireCapability(c, "action:stock.manage", [...WRITE]);
    const body = await readJsonObject(c);
    const openingLines = asArray(body.lines)
      .map((x) => ({
        productId: asId(x.productId),
        packSizeLitres: Number(x.packSizeLitres),
        brand: strOrNull(x.brand),
        qtyUnits: Number(x.qtyUnits),
        rate: numOrNull(x.rate),
        // Optional go-live detail (mirrors stock-in); expiry feeds near-expiry.
        batchNumber: strOrNull(x.batchNumber),
        expiryDate: strOrNull(x.expiryDate),
        rackNo: strOrNull(x.rackNo),
        shelfNo: strOrNull(x.shelfNo),
        binNo: strOrNull(x.binNo),
      }))
      .filter((l) => l.productId && l.packSizeLitres > 0 && Number.isFinite(l.qtyUnits) && l.qtyUnits > 0);
    const openingLocationId = requiredString(body, "locationId");
    const sql = getSqlClient(c);
    const result = await postOpening(sql, auth.userId!, {
      locationId: openingLocationId,
      openingDate: strOrNull(body.openingDate),
      lines: openingLines,
    });
    // Seeding opening stock can lift a SKU above reorder → auto-close its alert.
    await notifyReorder(c, sql, openingLines.map((l) => ({ locationId: openingLocationId, productId: l.productId, packSizeLitres: l.packSizeLitres })));
    return c.json(success(c, result), 201);
  })

  // ── Set/clear a SKU's reorder level at a godown (drives low-stock flag) ──
  .put("/reorder", async (c) => {
    await requireCapability(c, "action:stock.manage", [...WRITE]);
    const body = await readJsonObject(c);
    const level = body.reorderLevel == null || body.reorderLevel === "" ? null : Number(body.reorderLevel);
    if (level !== null && (!Number.isFinite(level) || level < 0)) {
      throw new ApiError("INVALID_FIELD", "Reorder level must be zero or more.", 422);
    }
    await setReorderLevel(getSqlClient(c), {
      locationId: requiredString(body, "locationId"),
      productId: requiredString(body, "productId"),
      packSizeLitres: Number(body.packSizeLitres),
      reorderLevel: level,
    });
    return c.json(success(c, { ok: true }));
  })

  // ── Rebuild the balance cache from the ledger (admin self-heal) ──
  .post("/recompute", async (c) => {
    requireRole(c, ["SUPER_ADMIN"]);
    const result = await recomputeBalances(getSqlClient(c));
    return c.json(success(c, result));
  });
