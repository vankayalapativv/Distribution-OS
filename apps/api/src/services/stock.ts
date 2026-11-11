/**
 * Stock Journal service (migration 0004).
 *
 * Reads: SKU catalogue (products × packs), on-hand balances, and the movement
 * ledger. Writes: GRN (stock in), inter-godown transfer (paired ± movements),
 * adjustment, and opening stock — each posts its document + ledger rows + balance
 * upserts in ONE `sql.transaction` batch (Neon is batch-only; the non-negative
 * balance CHECK is the hard-block backstop). SKUs are the existing catalogue.
 */
import type { SqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";
import { isUniqueViolation, retryOnUniqueViolation } from "../lib/pg-errors";
import { num, str } from "./orders-shared";
import {
  balanceStmt,
  lotBalanceStmt,
  mapBalanceRow,
  movementStmt,
  round2,
  stockUnit,
  type MovementKind,
  type StockLineInput,
} from "./stock-shared";

/** A rate is mandatory on stock-in and opening lines: a finite number > 0. */
function isPositiveRate(rate: number | null | undefined): boolean {
  return rate != null && Number.isFinite(rate) && rate > 0;
}

/** Normalize a date-ish value (string or Neon `Date`) to a `yyyy-mm-dd` key, or "". */
function ymd(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") return "";
  return String(v).slice(0, 10);
}

/** NULL-safe lot identity key — matches the `stock_lots_identity_idx` columns
 *  (location is fixed per call, so it is omitted). Used to map lines ↔ lot ids. */
function lotIdentityKey(l: { productId: string; packSizeLitres: number; brand: string | null; batchNumber?: string | null; expiryDate?: string | null; rate?: number | null }): string {
  // Rate is part of the identity (matches `stock_lots_identity_idx`'s coalesce(rate,-1)):
  // the same batch + expiry received at a different rate is a DISTINCT lot, so each
  // parcel keeps its own purchase cost for per-batch FEFO costing.
  return [l.productId, num(l.packSizeLitres), l.brand ?? "", l.batchNumber ?? "", ymd(l.expiryDate), l.rate == null ? -1 : num(l.rate)].join("|");
}

/** A line that becomes (or adds to) a batch lot. */
interface LotLine {
  productId: string; packSizeLitres: number; brand: string | null;
  rate?: number | null;
  batchNumber?: string | null; expiryDate?: string | null;
  rackNo?: string | null; shelfNo?: string | null; binNo?: string | null;
}

/** Create-or-fetch the lot identity rows for a set of lines at one godown, in a
 *  single idempotent bulk upsert (dedupes on `stock_lots_identity_idx`). Returns a
 *  map from each line's identity key to its lot id. The lot's cached qty is NOT
 *  changed here — callers add `lotBalanceStmt(...)` inside their write txn. */
async function ensureLots(
  sql: SqlClient,
  locationId: string,
  userId: string,
  lines: LotLine[],
  sourceType: string,
  sourceId: string | null,
  receivedDate: string | null,
): Promise<Map<string, string>> {
  const distinct = new Map<string, LotLine>();
  for (const l of lines) if (!distinct.has(lotIdentityKey(l))) distinct.set(lotIdentityKey(l), l);
  const lots = [...distinct.values()];
  // Neon's HTTP driver has no bulk-insert helper, so zip parallel typed arrays
  // through unnest() — one parameterized round-trip, NULL-safe per element.
  const ids = lots.map(() => crypto.randomUUID());
  const productIds = lots.map((l) => l.productId);
  const packs = lots.map((l) => l.packSizeLitres);
  const brands = lots.map((l) => l.brand ?? null);
  const batches = lots.map((l) => l.batchNumber ?? null);
  const expiries = lots.map((l) => l.expiryDate ?? null);
  const rates = lots.map((l) => l.rate ?? null);
  const racks = lots.map((l) => l.rackNo ?? null);
  const shelves = lots.map((l) => l.shelfNo ?? null);
  const bins = lots.map((l) => l.binNo ?? null);
  const returned = await sql`
    /* ensure_lots */
    insert into stock_lots
      (id, product_id, pack_size_litres, brand, location_id, batch_number, expiry_date, rate,
       rack_no, shelf_no, bin_no, received_date, source_type, source_id, created_by)
    select u.id, u.product_id, u.pack, u.brand, ${locationId}::uuid, u.batch, u.expiry, u.rate,
           u.rack, u.shelf, u.bin, ${receivedDate}::date, ${sourceType}, ${sourceId}::uuid, ${userId}::uuid
    from unnest(
      ${ids}::uuid[], ${productIds}::uuid[], ${packs}::numeric[], ${brands}::text[],
      ${batches}::text[], ${expiries}::date[], ${rates}::numeric[], ${racks}::text[], ${shelves}::text[], ${bins}::text[]
    ) as u(id, product_id, pack, brand, batch, expiry, rate, rack, shelf, bin)
    on conflict (location_id, product_id, pack_size_litres, coalesce(brand, ''), coalesce(batch_number, ''), coalesce(expiry_date, 'infinity'::date), coalesce(rate, -1))
    do update set updated_at = now()
    returning id, product_id as "productId", pack_size_litres as "packSizeLitres", brand, batch_number as "batchNumber", expiry_date as "expiryDate", rate
  `;
  const map = new Map<string, string>();
  for (const r of returned) {
    map.set(lotIdentityKey({
      productId: str(r.productId), packSizeLitres: num(r.packSizeLitres),
      brand: r.brand == null ? null : str(r.brand),
      batchNumber: r.batchNumber == null ? null : str(r.batchNumber),
      expiryDate: ymd(r.expiryDate) || null,
      rate: r.rate == null ? null : num(r.rate),
    }), str(r.id));
  }
  return map;
}

/** Catalogue SKUs (product × pack) for pickers and opening-stock entry. */
export async function listSkus(sql: SqlClient, opts: { search?: string | null; brand?: string | null }) {
  const search = opts.search?.trim() || null;
  const brand = opts.brand?.trim() || null;
  // Litres products are one SKU per pack; quantity (piece-sold) products have no
  // packs, so they surface as a single sentinel SKU at pack = 1 (shown as "pcs").
  const rows = await sql`
    /* list_stock_skus */
    select p.id as "productId", p.product_name as "productName", p.brand, p.hsn_code as "hsnCode",
           pp.pack_size_litres as "packSizeLitres", p.unit,
           (select ps.segment from product_segments ps where ps.product_id = p.id order by ps.segment limit 1) as segment
    from product_packs pp
    join products p on p.id = pp.product_id and p.status = 'active' and p.unit = 'litres'
    where (${search}::text is null or p.product_name ilike '%' || ${search} || '%')
      and (${brand}::text is null or p.brand = ${brand})
    union all
    select p.id as "productId", p.product_name as "productName", p.brand, p.hsn_code as "hsnCode",
           1 as "packSizeLitres", p.unit,
           (select ps.segment from product_segments ps where ps.product_id = p.id order by ps.segment limit 1) as segment
    from products p
    where p.status = 'active' and p.unit = 'quantity'
      and (${search}::text is null or p.product_name ilike '%' || ${search} || '%')
      and (${brand}::text is null or p.brand = ${brand})
    order by "productName", "packSizeLitres"
    limit 500
  `;
  return rows.map((r) => ({
    productId: str(r.productId),
    productName: str(r.productName),
    brand: r.brand == null ? null : str(r.brand),
    hsnCode: r.hsnCode == null ? null : str(r.hsnCode),
    packSizeLitres: num(r.packSizeLitres),
    unit: r.unit === "quantity" ? "quantity" : "litres",
    segment: r.segment == null ? null : str(r.segment),
  }));
}

export interface BalanceFilters {
  locationId?: string | null;
  search?: string | null;
  lowOnly?: boolean;
  page?: number | null;
  pageSize?: number | null;
}

/** On-hand balances. With a locationId the FULL catalogue for that godown is
 *  returned (0 for unstocked SKUs, so opening stock can be entered); without one,
 *  every stocked SKU × godown row across the business. */
export async function listBalances(sql: SqlClient, f: BalanceFilters) {
  const loc = f.locationId?.trim() || null;
  const search = f.search?.trim() || null;
  const low = f.lowOnly === true;
  const pageSize = Math.min(100, Math.max(1, f.pageSize ?? 50));
  const page = Math.max(1, f.page ?? 1);
  const offset = (page - 1) * pageSize;

  const rows = loc
    ? await sql`
        /* list_balances_by_location */
        select l.id as "locationId", l.name as "locationName", p.id as "productId",
               p.product_name as "productName", p.brand,
               (select ps.segment from product_segments ps where ps.product_id = p.id order by ps.segment limit 1) as segment,
               pp.pack_size_litres as "packSizeLitres", p.unit,
               coalesce(sb.qty_units, 0) as "qtyUnits", sb.reorder_level as "reorderLevel",
               count(*) over () as "totalCount"
        from product_packs pp
        join products p on p.id = pp.product_id and p.status = 'active'
        join stock_locations l on l.id = ${loc}::uuid
        left join stock_balances sb
          on sb.location_id = l.id and sb.product_id = pp.product_id and sb.pack_size_litres = pp.pack_size_litres
        where (${search}::text is null or p.product_name ilike '%' || ${search} || '%')
          and (${low} = false or (sb.reorder_level is not null and coalesce(sb.qty_units,0) < sb.reorder_level))
        order by p.product_name, pp.pack_size_litres
        limit ${pageSize} offset ${offset}
      `
    : await sql`
        /* list_balances_all */
        select l.id as "locationId", l.name as "locationName", p.id as "productId",
               p.product_name as "productName", p.brand,
               (select ps.segment from product_segments ps where ps.product_id = p.id order by ps.segment limit 1) as segment,
               sb.pack_size_litres as "packSizeLitres", p.unit,
               sb.qty_units as "qtyUnits", sb.reorder_level as "reorderLevel",
               count(*) over () as "totalCount"
        from stock_balances sb
        join stock_locations l on l.id = sb.location_id
        join products p on p.id = sb.product_id
        where (${search}::text is null or p.product_name ilike '%' || ${search} || '%')
          and (${low} = false or (sb.reorder_level is not null and sb.qty_units < sb.reorder_level))
        order by l.name, p.product_name, sb.pack_size_litres
        limit ${pageSize} offset ${offset}
      `;
  const total = rows.length > 0 ? num(rows[0].totalCount) : 0;
  return { rows: rows.map(mapBalanceRow), total, page, pageSize };
}

/** Headline KPIs for the Balances tab (scoped to the godown filter):
 *  distinct SKUs on hand, total litres on hand, and how many are below reorder. */
export async function balancesSummary(sql: SqlClient, f: { locationId?: string | null }) {
  const loc = f.locationId?.trim() || null;
  const [r] = await sql`
    /* balances_summary */
    select
      count(*) filter (where qty_units > 0) as "skuCount",
      coalesce(sum(qty_units * pack_size_litres) filter (where qty_units > 0), 0) as "totalLitres",
      count(*) filter (where reorder_level is not null and qty_units < reorder_level) as "belowReorder"
    from stock_balances
    where (${loc}::uuid is null or location_id = ${loc}::uuid)
  `;
  return { skuCount: num(r?.skuCount ?? 0), totalLitres: round2(num(r?.totalLitres ?? 0)), belowReorder: num(r?.belowReorder ?? 0) };
}

/** Per-godown on-hand breakdown (drives the dashboard stat-card drill-downs):
 *  stocked SKU count, total units and total litres at each active godown. */
export async function balancesByGodown(sql: SqlClient) {
  const rows = await sql`
    /* balances_by_godown */
    select l.id as "locationId", l.name as "locationName",
      count(*) filter (where sb.qty_units > 0) as "skuCount",
      coalesce(sum(sb.qty_units) filter (where sb.qty_units > 0), 0) as "units",
      coalesce(sum(sb.qty_units * sb.pack_size_litres) filter (where sb.qty_units > 0), 0) as "litres"
    from stock_locations l
    left join stock_balances sb on sb.location_id = l.id
    where l.status = 'active'
    group by l.id, l.name
    order by l.name
  `;
  return rows.map((r) => ({
    locationId: str(r.locationId), locationName: str(r.locationName),
    skuCount: num(r.skuCount), units: num(r.units), litres: round2(num(r.litres)),
  }));
}

/** The movement ledger (the journal feed / Movements tab). */
export async function listMovements(
  sql: SqlClient,
  f: { locationId?: string | null; productId?: string | null; kind?: string | null; page?: number | null; pageSize?: number | null },
) {
  const loc = f.locationId?.trim() || null;
  const prod = f.productId?.trim() || null;
  const kind = f.kind?.trim() || null;
  const pageSize = Math.min(100, Math.max(1, f.pageSize ?? 30));
  const page = Math.max(1, f.page ?? 1);
  const offset = (page - 1) * pageSize;
  const rows = await sql`
    /* list_stock_movements */
    select m.id, m.kind, m.qty_units as "qtyUnits", m.litres, m.pack_size_litres as "packSizeLitres",
           m.ref_type as "refType", m.ref_id as "refId", m.note, m.moved_at as "movedAt",
           l.name as "locationName", p.product_name as "productName", m.brand,
           count(*) over () as "totalCount"
    from stock_movements m
    join stock_locations l on l.id = m.location_id
    join products p on p.id = m.product_id
    where (${loc}::uuid is null or m.location_id = ${loc}::uuid)
      and (${prod}::uuid is null or m.product_id = ${prod}::uuid)
      and (${kind}::text is null or m.kind = ${kind})
    order by m.moved_at desc, m.created_at desc
    limit ${pageSize} offset ${offset}
  `;
  const total = rows.length > 0 ? num(rows[0].totalCount) : 0;
  return {
    rows: rows.map((r) => ({
      id: str(r.id),
      kind: str(r.kind) as MovementKind,
      qtyUnits: num(r.qtyUnits),
      litres: num(r.litres),
      packSizeLitres: num(r.packSizeLitres),
      productName: str(r.productName),
      brand: r.brand == null ? null : str(r.brand),
      locationName: str(r.locationName),
      refType: r.refType == null ? null : str(r.refType),
      refId: r.refId == null ? null : str(r.refId),
      note: r.note == null ? null : str(r.note),
      movedAt: str(r.movedAt),
    })),
    total,
    page,
    pageSize,
  };
}

interface DocListFilter { locationId?: string | null; page?: number | null; pageSize?: number | null }
function pageOf(f: DocListFilter) {
  const pageSize = Math.min(100, Math.max(1, f.pageSize ?? 15));
  const page = Math.max(1, f.page ?? 1);
  return { pageSize, page, offset: (page - 1) * pageSize };
}

/** Posted GRN documents (the GRN tab). */
export async function listGrns(sql: SqlClient, f: DocListFilter) {
  const loc = f.locationId?.trim() || null;
  const { pageSize, page, offset } = pageOf(f);
  const rows = await sql`
    /* list_grns */
    select g.id, g.grn_number as "grnNumber", g.received_date as "receivedDate", g.supplier_name as "supplierName",
           g.supplier_invoice_no as "supplierInvoiceNo", l.name as "locationName", g.total_value as "totalValue", g.status,
           (select count(*) from goods_receipt_items gi where gi.grn_id = g.id) as "lineCount",
           count(*) over () as "totalCount"
    from goods_receipts g join stock_locations l on l.id = g.location_id
    where (${loc}::uuid is null or g.location_id = ${loc}::uuid)
    order by g.created_at desc
    limit ${pageSize} offset ${offset}
  `;
  return {
    rows: rows.map((r) => ({
      id: str(r.id), docNumber: str(r.grnNumber), date: str(r.receivedDate),
      party: str(r.supplierName), reference: r.supplierInvoiceNo == null ? null : str(r.supplierInvoiceNo),
      locationName: str(r.locationName), value: num(r.totalValue), lineCount: num(r.lineCount), status: str(r.status),
    })),
    total: rows.length > 0 ? num(rows[0].totalCount) : 0, page, pageSize,
  };
}

/** Posted transfer documents (the Transfers tab). */
export async function listTransfers(sql: SqlClient, f: DocListFilter) {
  const loc = f.locationId?.trim() || null;
  const { pageSize, page, offset } = pageOf(f);
  const rows = await sql`
    /* list_transfers */
    select t.id, t.transfer_number as "transferNumber", t.transfer_date as "transferDate",
           fl.name as "fromName", tl.name as "toName", t.status,
           (select count(*) from stock_transfer_items ti where ti.transfer_id = t.id) as "lineCount",
           count(*) over () as "totalCount"
    from stock_transfers t
    join stock_locations fl on fl.id = t.from_location_id
    join stock_locations tl on tl.id = t.to_location_id
    where (${loc}::uuid is null or t.from_location_id = ${loc}::uuid or t.to_location_id = ${loc}::uuid)
    order by t.created_at desc
    limit ${pageSize} offset ${offset}
  `;
  return {
    rows: rows.map((r) => ({
      id: str(r.id), docNumber: str(r.transferNumber), date: str(r.transferDate),
      route: `${str(r.fromName)} → ${str(r.toName)}`, lineCount: num(r.lineCount), status: str(r.status),
    })),
    total: rows.length > 0 ? num(rows[0].totalCount) : 0, page, pageSize,
  };
}

/** Posted adjustment documents (the Adjustments tab). */
export async function listAdjustments(sql: SqlClient, f: DocListFilter) {
  const loc = f.locationId?.trim() || null;
  const { pageSize, page, offset } = pageOf(f);
  const rows = await sql`
    /* list_adjustments */
    select a.id, a.adjustment_number as "adjustmentNumber", a.adjustment_date as "adjustmentDate", a.reason, a.note,
           l.name as "locationName",
           (select count(*) from stock_adjustment_items ai where ai.adjustment_id = a.id) as "lineCount",
           count(*) over () as "totalCount"
    from stock_adjustments a join stock_locations l on l.id = a.location_id
    where (${loc}::uuid is null or a.location_id = ${loc}::uuid)
    order by a.created_at desc
    limit ${pageSize} offset ${offset}
  `;
  return {
    rows: rows.map((r) => ({
      id: str(r.id), docNumber: str(r.adjustmentNumber), date: str(r.adjustmentDate),
      reason: str(r.reason), note: r.note == null ? null : str(r.note),
      locationName: str(r.locationName), lineCount: num(r.lineCount),
    })),
    total: rows.length > 0 ? num(rows[0].totalCount) : 0, page, pageSize,
  };
}

// ── Single-document detail (row-click drawers) ──

/** One GRN with its line items. */
export async function getGrn(sql: SqlClient, id: string) {
  const [h] = await sql`
    /* get_grn */
    select g.id, g.grn_number as "docNumber", g.received_date as "date", g.supplier_name as "supplierName",
           g.supplier_invoice_no as "supplierInvoiceNo", l.name as "locationName", g.total_value as "totalValue",
           g.status, g.note
    from goods_receipts g join stock_locations l on l.id = g.location_id
    where g.id = ${id}::uuid
  `;
  if (!h) throw new ApiError("NOT_FOUND", "GRN not found.", 404);
  const lines = await sql`
    select p.product_name as "productName", gi.pack_size_litres as "packSizeLitres", p.unit, gi.brand,
           gi.qty_units as "qtyUnits", gi.rate, gi.amount,
           gi.batch_number as "batchNumber", gi.expiry_date as "expiryDate",
           gi.rack_no as "rackNo", gi.shelf_no as "shelfNo", gi.bin_no as "binNo"
    from goods_receipt_items gi join products p on p.id = gi.product_id
    where gi.grn_id = ${id}::uuid order by p.product_name
  `;
  return {
    id: str(h.id), docNumber: str(h.docNumber), date: str(h.date), supplierName: str(h.supplierName),
    supplierInvoiceNo: h.supplierInvoiceNo == null ? null : str(h.supplierInvoiceNo),
    locationName: str(h.locationName), totalValue: num(h.totalValue), status: str(h.status),
    note: h.note == null ? null : str(h.note),
    lines: lines.map((r) => ({
      productName: str(r.productName), packSizeLitres: num(r.packSizeLitres), unit: stockUnit(r.unit), brand: r.brand == null ? null : str(r.brand),
      qtyUnits: num(r.qtyUnits), rate: r.rate == null ? null : num(r.rate), amount: r.amount == null ? null : num(r.amount),
      batchNumber: r.batchNumber == null ? null : str(r.batchNumber),
      expiryDate: r.expiryDate == null ? null : str(r.expiryDate),
      rackNo: r.rackNo == null ? null : str(r.rackNo),
      shelfNo: r.shelfNo == null ? null : str(r.shelfNo),
      binNo: r.binNo == null ? null : str(r.binNo),
    })),
  };
}

/** Advisory FEFO: stock-in (GRN) + opening-stock lines that carry an expiry date,
 *  soonest first, within an optional window + godown filter. Balances are per-SKU
 *  (not per-batch), so each row shows the received batch nearing expiry plus the
 *  SKU's current on-hand at that godown, so staff can push the oldest stock first. */
export async function listNearExpiry(
  sql: SqlClient,
  f: { locationId?: string | null; withinDays?: number | null },
) {
  const locationId = f.locationId?.trim() || null;
  const withinDays = f.withinDays != null && f.withinDays > 0 ? Math.floor(f.withinDays) : null;
  const rows = await sql`
    /* list_near_expiry */
    select sl.id, p.product_name as "productName", sl.pack_size_litres as "packSizeLitres", p.unit, sl.brand,
           sl.batch_number as "batchNumber", sl.expiry_date as "expiryDate", sl.rate, sl.qty_units as "qtyUnits",
           sl.rack_no as "rackNo", sl.shelf_no as "shelfNo", sl.bin_no as "binNo",
           coalesce(g.grn_number, 'Opening stock') as "grnNumber",
           coalesce(sl.received_date, sl.created_at::date) as "receivedDate",
           coalesce(g.supplier_name, 'Opening stock') as "supplierName",
           sl.location_id as "locationId", l.name as "locationName",
           (sl.expiry_date - (now() at time zone 'Asia/Kolkata')::date) as "daysToExpiry",
           sl.qty_units as "onHandQty"
    from stock_lots sl
    join stock_locations l on l.id = sl.location_id
    join products p on p.id = sl.product_id
    left join goods_receipts g on g.id = sl.source_id and sl.source_type = 'grn'
    where sl.expiry_date is not null and sl.qty_units > 0
      and (${locationId}::uuid is null or sl.location_id = ${locationId}::uuid)
      and (${withinDays}::int is null or sl.expiry_date <= (now() at time zone 'Asia/Kolkata')::date + ${withinDays}::int)
    order by sl.expiry_date asc, p.product_name asc
    limit 500
  `;
  return rows.map((r) => ({
    id: str(r.id), productName: str(r.productName), packSizeLitres: num(r.packSizeLitres), unit: stockUnit(r.unit),
    brand: r.brand == null ? null : str(r.brand), batchNumber: r.batchNumber == null ? null : str(r.batchNumber),
    expiryDate: str(r.expiryDate), rate: r.rate == null ? null : num(r.rate), qtyUnits: num(r.qtyUnits),
    rackNo: r.rackNo == null ? null : str(r.rackNo), shelfNo: r.shelfNo == null ? null : str(r.shelfNo), binNo: r.binNo == null ? null : str(r.binNo),
    grnNumber: str(r.grnNumber), receivedDate: str(r.receivedDate), supplierName: str(r.supplierName),
    locationId: str(r.locationId), locationName: str(r.locationName),
    daysToExpiry: num(r.daysToExpiry), onHandQty: num(r.onHandQty),
  }));
}

/** Stock lookup for one product: on-hand per godown, received batches (with
 *  expiry + shelf location), and its recent movements. Read-only. */
export async function lookupProductStock(sql: SqlClient, productId: string) {
  const [prod] = await sql`
    /* lookup_product */
    select p.id, p.product_name as "productName", p.brand, p.unit,
      (select ps.segment from product_segments ps where ps.product_id = p.id order by ps.segment limit 1) as segment
    from products p where p.id = ${productId}::uuid
  `;
  if (!prod) throw new ApiError("NOT_FOUND", "Product not found.", 404);
  // One product → one unit; apply it to every balance + batch row below.
  const unit = stockUnit(prod.unit);

  const balances = await sql`
    /* lookup_balances */
    select l.name as "locationName", sb.pack_size_litres as "packSizeLitres",
      sb.qty_units as "qtyUnits", sb.reorder_level as "reorderLevel"
    from stock_balances sb
    join stock_locations l on l.id = sb.location_id
    where sb.product_id = ${productId}::uuid and (sb.qty_units <> 0 or sb.reorder_level is not null)
    order by l.name, sb.pack_size_litres
  `;

  const batches = await sql`
    /* lookup_batches */
    select sl.id, sl.pack_size_litres as "packSizeLitres", sl.batch_number as "batchNumber",
      sl.expiry_date as "expiryDate", sl.rate, sl.rack_no as "rackNo", sl.shelf_no as "shelfNo", sl.bin_no as "binNo",
      sl.qty_units as "qtyUnits", l.name as "locationName",
      coalesce(sl.received_date, sl.created_at::date) as "receivedDate",
      coalesce(g.grn_number, 'Opening stock') as "source",
      (sl.expiry_date - (now() at time zone 'Asia/Kolkata')::date) as "daysToExpiry"
    from stock_lots sl
    join stock_locations l on l.id = sl.location_id
    left join goods_receipts g on g.id = sl.source_id and sl.source_type = 'grn'
    where sl.product_id = ${productId}::uuid and sl.qty_units > 0
    order by sl.expiry_date asc nulls last, sl.received_date desc nulls last
    limit 100
  `;

  const movements = await listMovements(sql, { productId, pageSize: 15 });

  let totalQty = 0;
  let totalLitres = 0;
  const balanceRows = balances.map((r) => {
    const qtyUnits = num(r.qtyUnits);
    const packSizeLitres = num(r.packSizeLitres);
    const reorderLevel = r.reorderLevel == null ? null : num(r.reorderLevel);
    totalQty += qtyUnits;
    totalLitres += qtyUnits * packSizeLitres;
    return { locationName: str(r.locationName), packSizeLitres, unit, qtyUnits, litres: round2(qtyUnits * packSizeLitres), reorderLevel, belowReorder: reorderLevel != null && qtyUnits < reorderLevel };
  });

  return {
    product: { id: str(prod.id), productName: str(prod.productName), brand: prod.brand == null ? null : str(prod.brand), segment: prod.segment == null ? null : str(prod.segment), unit },
    balances: balanceRows,
    totals: { qtyUnits: totalQty, litres: round2(totalLitres) },
    batches: batches.map((r) => ({
      id: str(r.id), packSizeLitres: num(r.packSizeLitres), unit, batchNumber: r.batchNumber == null ? null : str(r.batchNumber),
      expiryDate: r.expiryDate == null ? null : str(r.expiryDate), rate: r.rate == null ? null : num(r.rate), rackNo: r.rackNo == null ? null : str(r.rackNo),
      shelfNo: r.shelfNo == null ? null : str(r.shelfNo), binNo: r.binNo == null ? null : str(r.binNo),
      qtyUnits: num(r.qtyUnits), locationName: str(r.locationName), receivedDate: str(r.receivedDate),
      source: str(r.source), daysToExpiry: r.daysToExpiry == null ? null : num(r.daysToExpiry),
    })),
    movements: movements.rows,
  };
}

/** One transfer with its line items. */
export async function getTransfer(sql: SqlClient, id: string) {
  const [h] = await sql`
    /* get_transfer */
    select t.id, t.transfer_number as "docNumber", t.transfer_date as "date", t.note, t.status,
           fl.name as "fromName", tl.name as "toName"
    from stock_transfers t
    join stock_locations fl on fl.id = t.from_location_id
    join stock_locations tl on tl.id = t.to_location_id
    where t.id = ${id}::uuid
  `;
  if (!h) throw new ApiError("NOT_FOUND", "Transfer not found.", 404);
  const lines = await sql`
    select p.product_name as "productName", ti.pack_size_litres as "packSizeLitres", p.unit, ti.brand, ti.qty_units as "qtyUnits"
    from stock_transfer_items ti join products p on p.id = ti.product_id
    where ti.transfer_id = ${id}::uuid order by p.product_name
  `;
  return {
    id: str(h.id), docNumber: str(h.docNumber), date: str(h.date), status: str(h.status),
    fromName: str(h.fromName), toName: str(h.toName), note: h.note == null ? null : str(h.note),
    lines: lines.map((r) => ({
      productName: str(r.productName), packSizeLitres: num(r.packSizeLitres), unit: stockUnit(r.unit), brand: r.brand == null ? null : str(r.brand),
      qtyUnits: num(r.qtyUnits),
    })),
  };
}

/** One adjustment with its line items. */
export async function getAdjustment(sql: SqlClient, id: string) {
  const [h] = await sql`
    /* get_adjustment */
    select a.id, a.adjustment_number as "docNumber", a.adjustment_date as "date", a.reason, a.note,
           l.name as "locationName"
    from stock_adjustments a join stock_locations l on l.id = a.location_id
    where a.id = ${id}::uuid
  `;
  if (!h) throw new ApiError("NOT_FOUND", "Adjustment not found.", 404);
  const lines = await sql`
    select p.product_name as "productName", ai.pack_size_litres as "packSizeLitres", p.unit, ai.brand, ai.delta_units as "deltaUnits"
    from stock_adjustment_items ai join products p on p.id = ai.product_id
    where ai.adjustment_id = ${id}::uuid order by p.product_name
  `;
  return {
    id: str(h.id), docNumber: str(h.docNumber), date: str(h.date), reason: str(h.reason),
    locationName: str(h.locationName), note: h.note == null ? null : str(h.note),
    lines: lines.map((r) => ({
      productName: str(r.productName), packSizeLitres: num(r.packSizeLitres), unit: stockUnit(r.unit), brand: r.brand == null ? null : str(r.brand),
      deltaUnits: num(r.deltaUnits),
    })),
  };
}

/** Current balances for a set of SKUs at one location — the invoice hard-block pre-check. */
export async function getBalancesForSkus(
  sql: SqlClient,
  locationId: string,
  skus: { productId: string; packSizeLitres: number }[],
): Promise<Map<string, number>> {
  if (skus.length === 0) return new Map();
  const productIds = skus.map((s) => s.productId);
  const packs = skus.map((s) => s.packSizeLitres);
  const rows = await sql`
    /* balances_for_skus */
    select product_id as "productId", pack_size_litres as "packSizeLitres", qty_units as "qtyUnits"
    from stock_balances
    where location_id = ${locationId}::uuid
      and (product_id, pack_size_litres) in (
        select pid, pk from unnest(${productIds}::uuid[], ${packs}::numeric[]) as t(pid, pk)
      )
  `;
  const map = new Map<string, number>();
  for (const r of rows) map.set(`${str(r.productId)}|${num(r.packSizeLitres)}`, num(r.qtyUnits));
  return map;
}

// ── Document number generators (racy max+1, retried on the unique constraint) ──
async function nextGrnNumber(sql: SqlClient): Promise<string> {
  const [r] = await sql`select coalesce(max(substring(grn_number from 5)::int), 0) + 1 as n from goods_receipts where grn_number ~ '^GRN-[0-9]+$'`;
  return `GRN-${String(num(r?.n ?? 1)).padStart(5, "0")}`;
}
async function nextTransferNumber(sql: SqlClient): Promise<string> {
  const [r] = await sql`select coalesce(max(substring(transfer_number from 5)::int), 0) + 1 as n from stock_transfers where transfer_number ~ '^TRF-[0-9]+$'`;
  return `TRF-${String(num(r?.n ?? 1)).padStart(5, "0")}`;
}
async function nextAdjustmentNumber(sql: SqlClient): Promise<string> {
  const [r] = await sql`select coalesce(max(substring(adjustment_number from 5)::int), 0) + 1 as n from stock_adjustments where adjustment_number ~ '^ADJ-[0-9]+$'`;
  return `ADJ-${String(num(r?.n ?? 1)).padStart(5, "0")}`;
}

export interface GrnInput {
  locationId: string;
  supplierName: string;
  supplierInvoiceNo: string | null;
  supplierInvoiceDate: string | null;
  receivedDate: string | null;
  reference: string | null;
  note: string | null;
  lines: (StockLineInput & {
    rate: number | null;
    // All optional, captured at stock-in; `expiryDate` feeds the near-expiry report.
    batchNumber?: string | null;
    expiryDate?: string | null;
    rackNo?: string | null;
    shelfNo?: string | null;
    binNo?: string | null;
  })[];
}

export async function postGrn(sql: SqlClient, userId: string, input: GrnInput) {
  if (input.lines.length === 0) throw new ApiError("INVALID_FIELD", "Add at least one line.", 422);
  if (input.lines.some((l) => !isPositiveRate(l.rate))) throw new ApiError("INVALID_FIELD", "Every line needs a rate greater than 0.", 422);
  const total = round2(input.lines.reduce((s, l) => s + (l.rate ?? 0) * l.qtyUnits, 0));
  return retryOnUniqueViolation(async () => {
    const grnNo = await nextGrnNumber(sql);
    const grnId = crypto.randomUUID();
    const lots = await ensureLots(sql, input.locationId, userId, input.lines, "grn", grnId, input.receivedDate);
    const lotId = (l: GrnInput["lines"][number]) => lots.get(lotIdentityKey(l))!;
    const stmts = [
      sql`
        /* create_grn */
        insert into goods_receipts
          (id, grn_number, location_id, supplier_name, supplier_invoice_no, supplier_invoice_date,
           received_date, reference, total_value, note, created_by)
        values (${grnId}::uuid, ${grnNo}, ${input.locationId}::uuid, ${input.supplierName},
          ${input.supplierInvoiceNo}, ${input.supplierInvoiceDate}::date,
          coalesce(${input.receivedDate}::date, (now() at time zone 'Asia/Kolkata')::date),
          ${input.reference}, ${total}, ${input.note}, ${userId}::uuid)
      `,
      ...input.lines.map((l) => sql`
        insert into goods_receipt_items
          (grn_id, product_id, pack_size_litres, brand, qty_units, rate, amount,
           batch_number, expiry_date, rack_no, shelf_no, bin_no)
        values (${grnId}::uuid, ${l.productId}::uuid, ${l.packSizeLitres}, ${l.brand}, ${l.qtyUnits},
                ${l.rate}, ${l.rate == null ? null : round2(l.rate * l.qtyUnits)},
                ${l.batchNumber ?? null}, ${l.expiryDate ?? null}::date, ${l.rackNo ?? null}, ${l.shelfNo ?? null}, ${l.binNo ?? null})
      `),
      ...input.lines.map((l) =>
        movementStmt(sql, { locationId: input.locationId, productId: l.productId, packSizeLitres: l.packSizeLitres, brand: l.brand, qtyUnits: Math.abs(l.qtyUnits), kind: "grn", refType: "grn", refId: grnId, batchId: lotId(l), note: null, movedAt: input.receivedDate }, userId),
      ),
      ...input.lines.map((l) =>
        balanceStmt(sql, { locationId: input.locationId, productId: l.productId, packSizeLitres: l.packSizeLitres, delta: Math.abs(l.qtyUnits) }),
      ),
      ...input.lines.map((l) => lotBalanceStmt(sql, lotId(l), Math.abs(l.qtyUnits))),
    ];
    await sql.transaction(stmts);
    return { id: grnId, grnNumber: grnNo, totalValue: total };
  }, { constraint: "goods_receipts_grn_number_key" });
}

/** Available batch lots for one SKU at one godown — on-hand only, FEFO-sorted
 *  (soonest expiry first). Drives the Transfer/Adjust batch pickers. */
export async function listAvailableLots(
  sql: SqlClient,
  f: { locationId: string; productId: string; packSizeLitres?: number | null },
) {
  const pack = f.packSizeLitres ?? null;
  const rows = await sql`
    /* list_available_lots */
    select sl.id, sl.pack_size_litres as "packSizeLitres", sl.batch_number as "batchNumber",
      sl.expiry_date as "expiryDate", sl.rate, sl.rack_no as "rackNo", sl.shelf_no as "shelfNo", sl.bin_no as "binNo",
      sl.qty_units as "qtyUnits", coalesce(sl.received_date, sl.created_at::date) as "receivedDate",
      coalesce(g.grn_number, 'Opening stock') as "source",
      (sl.expiry_date - (now() at time zone 'Asia/Kolkata')::date) as "daysToExpiry"
    from stock_lots sl
    left join goods_receipts g on g.id = sl.source_id and sl.source_type = 'grn'
    where sl.location_id = ${f.locationId}::uuid and sl.product_id = ${f.productId}::uuid and sl.qty_units > 0
      and (${pack}::numeric is null or sl.pack_size_litres = ${pack}::numeric)
    order by sl.expiry_date asc nulls last, coalesce(sl.received_date, sl.created_at::date) asc
    limit 200
  `;
  return rows.map((r) => ({
    id: str(r.id), packSizeLitres: num(r.packSizeLitres),
    batchNumber: r.batchNumber == null ? null : str(r.batchNumber),
    expiryDate: r.expiryDate == null ? null : ymd(r.expiryDate),
    rate: r.rate == null ? null : num(r.rate),
    rackNo: r.rackNo == null ? null : str(r.rackNo), shelfNo: r.shelfNo == null ? null : str(r.shelfNo), binNo: r.binNo == null ? null : str(r.binNo),
    qtyUnits: num(r.qtyUnits), receivedDate: ymd(r.receivedDate), source: str(r.source),
    daysToExpiry: r.daysToExpiry == null ? null : num(r.daysToExpiry),
  }));
}

export interface SaleAllocation { lotId: string; qty: number; rate: number | null }
interface LotAvail { lotId: string; expiryDate: string | null; qty: number; rate: number | null }

/** Pure FEFO split of `need` units across available lots (soonest expiry first);
 *  throws STOCK_SHORT if the lots don't cover it. Used to auto-allocate a sale.
 *  Each allocation carries the drawn lot's `rate` so the caller can cost the sale. */
export function fefoSplit(avail: LotAvail[], need: number): SaleAllocation[] {
  const expKey = (l: LotAvail) => l.expiryDate ?? "9999-12-31"; // null expiry sorts last
  const sorted = [...avail].sort((a, b) => expKey(a).localeCompare(expKey(b)));
  let n = round2(Math.abs(need));
  const out: SaleAllocation[] = [];
  for (const a of sorted) {
    if (n <= 0) break;
    const take = Math.min(n, a.qty);
    if (take > 0) { out.push({ lotId: a.lotId, qty: round2(take), rate: a.rate }); n = round2(n - take); }
  }
  if (n > 0) throw stockShortError();
  return out;
}

/** FEFO allocation for a sale of `qtyUnits` from the current on-hand lots at a godown. */
export async function allocateSaleFefo(
  sql: SqlClient,
  f: { locationId: string; productId: string; packSizeLitres: number; qtyUnits: number },
): Promise<SaleAllocation[]> {
  const lots = await listAvailableLots(sql, { locationId: f.locationId, productId: f.productId, packSizeLitres: f.packSizeLitres });
  return fefoSplit(lots.map((l) => ({ lotId: l.id, expiryDate: l.expiryDate, qty: l.qtyUnits, rate: l.rate })), f.qtyUnits);
}

/** Per-lot amounts an invoice's sale currently has deducted, net of reversals AND
 *  returns — i.e. what is STILL out per lot. Used to credit back on an edit/cancel
 *  (don't re-credit units a return already put back) and to target a return's
 *  restock at the exact lots the sale is still holding. */
export interface SaleLotCredit { productId: string; packSizeLitres: number; brand: string | null; batchId: string; expiryDate: string | null; rate: number | null; qty: number }
export async function currentSaleLots(sql: SqlClient, invoiceId: string): Promise<SaleLotCredit[]> {
  const rows = await sql`
    /* invoice_sale_lots */
    select m.product_id as "productId", m.pack_size_litres as "packSizeLitres", max(m.brand) as brand,
           m.batch_id as "batchId", sl.expiry_date as "expiryDate", sl.rate, (-sum(m.qty_units)) as qty
    from stock_movements m
    join stock_lots sl on sl.id = m.batch_id
    where m.ref_type = 'invoice' and m.ref_id = ${invoiceId}::uuid and m.kind in ('sale', 'sale_reversal', 'return') and m.batch_id is not null
    group by m.product_id, m.pack_size_litres, m.batch_id, sl.expiry_date, sl.rate
    having (-sum(m.qty_units)) > 0
  `;
  return rows.map((r) => ({
    productId: str(r.productId), packSizeLitres: num(r.packSizeLitres),
    brand: r.brand == null ? null : str(r.brand), batchId: str(r.batchId),
    expiryDate: r.expiryDate == null ? null : ymd(r.expiryDate), rate: r.rate == null ? null : num(r.rate), qty: num(r.qty),
  }));
}

/** A per-lot restock to post for a sales return: credit `qty` back to `batchId`. */
export interface ReturnRestock { productId: string; packSizeLitres: number; brand: string | null; batchId: string; qty: number }

/**
 * Allocate a sales return's quantities back to the lots the invoice's sale is
 * STILL holding (reverse-FEFO: earliest-expiry out-lot first, so returned goods
 * sell first), capped per lot at its still-out qty. The caller posts a `return`
 * movement + lot/balance increments for each entry. Throws STOCK_SHORT if the
 * still-out pool can't cover a line — `buildReturnLines` already caps the
 * returnable qty, so this is a backstop against a concurrent edit/cancel.
 */
export async function allocateReturnRestock(
  sql: SqlClient,
  invoiceId: string,
  lines: { productId: string; packSizeLitres: number; qtyUnits: number }[],
): Promise<ReturnRestock[]> {
  const stillOut = await currentSaleLots(sql, invoiceId);
  const key = (p: string, pk: number) => `${p}|${pk}`;
  const pool = new Map<string, SaleLotCredit[]>();
  for (const lot of stillOut) {
    const k = key(lot.productId, lot.packSizeLitres);
    const arr = pool.get(k);
    if (arr) arr.push({ ...lot });
    else pool.set(k, [{ ...lot }]);
  }
  for (const lots of pool.values()) {
    lots.sort((a, b) => (a.expiryDate ?? "9999-12-31").localeCompare(b.expiryDate ?? "9999-12-31"));
  }

  const out: ReturnRestock[] = [];
  for (const line of lines) {
    let remaining = round2(line.qtyUnits);
    if (remaining <= 0) continue;
    for (const lot of pool.get(key(line.productId, line.packSizeLitres)) ?? []) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, lot.qty);
      if (take <= 0) continue;
      out.push({ productId: lot.productId, packSizeLitres: lot.packSizeLitres, brand: lot.brand, batchId: lot.batchId, qty: round2(take) });
      lot.qty = round2(lot.qty - take);
      remaining = round2(remaining - take);
    }
    if (remaining > 0.005) {
      throw new ApiError("STOCK_SHORT", "Couldn't restock the return — the sale's lots don't cover it. Refresh balances and retry.", 409);
    }
  }
  return out;
}

/**
 * Adjust an invoice's return restock by a per-SKU DELTA (new returned qty − old),
 * used when a sales return is edited. A positive delta restocks MORE (adds to the
 * sale's still-out lots, reverse-FEFO); a negative delta UN-restocks (pulls units
 * back out of the lots this invoice's returns put them into, latest-expiry first).
 * Returns signed per-lot `return` movements (+ add / − remove) for the caller to post.
 */
export async function allocateReturnAdjustment(
  sql: SqlClient,
  invoiceId: string,
  deltas: { productId: string; packSizeLitres: number; delta: number }[],
): Promise<ReturnRestock[]> {
  const out: ReturnRestock[] = [];
  const positives = deltas.filter((d) => d.delta > 0.005).map((d) => ({ productId: d.productId, packSizeLitres: d.packSizeLitres, qtyUnits: round2(d.delta) }));
  if (positives.length) out.push(...(await allocateReturnRestock(sql, invoiceId, positives)));

  const negatives = deltas.filter((d) => d.delta < -0.005);
  if (negatives.length) {
    const rows = await sql`
      /* invoice_returned_lots */
      select m.product_id as "productId", m.pack_size_litres as "packSizeLitres", max(m.brand) as brand,
             m.batch_id as "batchId", sl.expiry_date as "expiryDate", sum(m.qty_units) as qty
      from stock_movements m
      join stock_lots sl on sl.id = m.batch_id
      where m.ref_type = 'invoice' and m.ref_id = ${invoiceId}::uuid and m.kind = 'return' and m.batch_id is not null
      group by m.product_id, m.pack_size_litres, m.batch_id, sl.expiry_date
      having sum(m.qty_units) > 0
    `;
    const key = (p: string, pk: number) => `${p}|${pk}`;
    const pool = new Map<string, { productId: string; packSizeLitres: number; brand: string | null; batchId: string; expiryDate: string | null; qty: number }[]>();
    for (const r of rows) {
      const lot = { productId: str(r.productId), packSizeLitres: num(r.packSizeLitres), brand: r.brand == null ? null : str(r.brand), batchId: str(r.batchId), expiryDate: r.expiryDate == null ? null : ymd(r.expiryDate), qty: num(r.qty) };
      const k = key(lot.productId, lot.packSizeLitres);
      const arr = pool.get(k);
      if (arr) arr.push(lot);
      else pool.set(k, [lot]);
    }
    for (const lots of pool.values()) {
      lots.sort((a, b) => (b.expiryDate ?? "0000-00-00").localeCompare(a.expiryDate ?? "0000-00-00")); // latest-expiry first (reverse of restock)
    }
    for (const neg of negatives) {
      let remaining = round2(-neg.delta);
      for (const lot of pool.get(key(neg.productId, neg.packSizeLitres)) ?? []) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, lot.qty);
        if (take <= 0) continue;
        out.push({ productId: lot.productId, packSizeLitres: lot.packSizeLitres, brand: lot.brand, batchId: lot.batchId, qty: -round2(take) });
        lot.qty = round2(lot.qty - take);
        remaining = round2(remaining - take);
      }
      if (remaining > 0.005) {
        throw new ApiError("STOCK_SHORT", "Couldn't reduce the return — the returned stock isn't available (it may have been re-sold). Refresh and retry.", 409);
      }
    }
  }
  return out;
}

/** Invoice stock events for the Recent-activity feed — per generated invoice a
 *  'sale' (net stock deducted) or a 'reversal' (cancelled → credited back), plus a
 *  'return' row when a sales return has restocked lots. Newest first. */
export interface InvoiceActivityRow {
  invoiceId: string; kind: "sale" | "reversal" | "return"; invoiceNumber: string; customerName: string | null;
  locationName: string; locationId: string; units: number; lineCount: number; value: number | null; movedAt: string;
}
export async function listInvoiceStockActivity(sql: SqlClient, f: { locationId?: string | null; limit?: number | null }) {
  const loc = f.locationId?.trim() || null;
  const limit = Math.min(100, Math.max(1, f.limit ?? 40));
  // One row per (generated invoice, row-kind). 'sale'/'sale_reversal' collapse to a
  // SALE row showing net units out — edits net to the truth; summing abs() would
  // double-count a reversed-then-reapplied sale (the bug that read an edited
  // 2-unit invoice as 4). 'return' movements form a RETURN row showing units
  // restocked. Each row carries its own max(moved_at) so a sale and its later
  // return order independently. A cancelled invoice's sale row reads as a
  // 'reversal' of the units credited back.
  const rows = await sql`
    /* list_invoice_stock_activity */
    select i.id as "invoiceId",
      (case when m.kind = 'return' then 'return' else 'sale' end) as "rowKind",
      i.invoice_number as "invoiceNumber", c.legal_name as "customerName",
      l.name as "locationName", i.location_id as "locationId", i.doc_status as "docStatus",
      sum(m.qty_units) as "signedUnits", count(distinct m.product_id) as "lineCount",
      i.invoice_net_value as "value",
      (select coalesce(sum(qty_units), 0) from invoice_items where invoice_id = i.id) as "lineUnits",
      max(m.moved_at) as "movedAt"
    from stock_movements m
    join invoices i on i.id = m.ref_id and m.ref_type = 'invoice' and i.invoice_source = 'generated'
    join stock_locations l on l.id = m.location_id
    left join customers c on c.id = i.customer_id
    where m.kind in ('sale', 'sale_reversal', 'return')
      and (${loc}::uuid is null or m.location_id = ${loc}::uuid)
    group by i.id, (case when m.kind = 'return' then 'return' else 'sale' end),
      i.invoice_number, c.legal_name, l.name, i.location_id, i.doc_status, i.invoice_net_value
    order by max(m.moved_at) desc
    limit ${limit}
  `;
  return rows.map((r) => {
    const isReturn = str(r.rowKind) === "return";
    const cancelled = str(r.docStatus) === "cancelled";
    const kind: "sale" | "reversal" | "return" = isReturn ? "return" : cancelled ? "reversal" : "sale";
    // return = +qty restocked; cancelled sale = units credited back; live sale = net units out.
    const units = isReturn ? num(r.signedUnits) : cancelled ? num(r.lineUnits) : -num(r.signedUnits);
    return {
      invoiceId: str(r.invoiceId), kind, invoiceNumber: str(r.invoiceNumber),
      customerName: r.customerName == null ? null : str(r.customerName),
      locationName: str(r.locationName), locationId: str(r.locationId),
      units, lineCount: num(r.lineCount),
      value: kind === "sale" && r.value != null ? num(r.value) : null, movedAt: str(r.movedAt),
    };
  });
}

/** The per-lot stock breakdown of one invoice's sale (or reversal) — the drawer
 *  shown when a sale row in Recent activity is clicked. */
export async function getInvoiceStockLots(sql: SqlClient, invoiceId: string, kind: "sale" | "reversal" | "return") {
  const [inv] = await sql`
    /* invoice_stock_header */
    select i.invoice_number as "invoiceNumber", i.invoice_date as "invoiceDate",
           c.legal_name as "customerName", l.name as "locationName"
    from invoices i left join customers c on c.id = i.customer_id left join stock_locations l on l.id = i.location_id
    where i.id = ${invoiceId}::uuid
  `;
  if (!inv) throw new ApiError("NOT_FOUND", "Invoice not found.", 404);
  // 'sale' = the lots the invoice CURRENTLY holds, netted per lot across
  // sale/sale_reversal (an edited invoice has both — summing abs() would
  // double-count the superseded sale). 'reversal' = the lots credited back on a
  // cancel. 'return' = the lots a sales return restocked.
  const lines =
    kind === "sale"
      ? await sql`
          /* invoice_stock_lots_sale */
          select p.product_name as "productName", m.pack_size_litres as "packSizeLitres", p.unit,
            sl.batch_number as "batchNumber", sl.expiry_date as "expiryDate", (-sum(m.qty_units)) as "qtyUnits"
          from stock_movements m
          join stock_lots sl on sl.id = m.batch_id
          join products p on p.id = m.product_id
          where m.ref_type = 'invoice' and m.ref_id = ${invoiceId}::uuid and m.kind in ('sale', 'sale_reversal')
          group by p.product_name, m.pack_size_litres, p.unit, m.batch_id, sl.batch_number, sl.expiry_date
          having (-sum(m.qty_units)) > 0
          order by p.product_name, sl.expiry_date
        `
      : kind === "return"
        ? await sql`
            /* invoice_stock_lots_return */
            select p.product_name as "productName", m.pack_size_litres as "packSizeLitres", p.unit,
              sl.batch_number as "batchNumber", sl.expiry_date as "expiryDate", sum(m.qty_units) as "qtyUnits"
            from stock_movements m
            join stock_lots sl on sl.id = m.batch_id
            join products p on p.id = m.product_id
            where m.ref_type = 'invoice' and m.ref_id = ${invoiceId}::uuid and m.kind = 'return'
            group by p.product_name, m.pack_size_litres, p.unit, sl.batch_number, sl.expiry_date
            order by p.product_name, sl.expiry_date
          `
        : await sql`
            /* invoice_stock_lots_reversal */
            select p.product_name as "productName", m.pack_size_litres as "packSizeLitres", p.unit,
              sl.batch_number as "batchNumber", sl.expiry_date as "expiryDate", sum(abs(m.qty_units)) as "qtyUnits"
            from stock_movements m
            join stock_lots sl on sl.id = m.batch_id
            join products p on p.id = m.product_id
            where m.ref_type = 'invoice' and m.ref_id = ${invoiceId}::uuid and m.kind = 'sale_reversal'
            group by p.product_name, m.pack_size_litres, p.unit, sl.batch_number, sl.expiry_date
            order by p.product_name, sl.expiry_date
          `;
  return {
    kind,
    invoiceNumber: str(inv.invoiceNumber), invoiceDate: str(inv.invoiceDate),
    customerName: inv.customerName == null ? null : str(inv.customerName),
    locationName: inv.locationName == null ? null : str(inv.locationName),
    lines: lines.map((r) => ({
      productName: str(r.productName), packSizeLitres: num(r.packSizeLitres), unit: stockUnit(r.unit),
      batchNumber: r.batchNumber == null ? null : str(r.batchNumber),
      expiryDate: r.expiryDate == null ? null : ymd(r.expiryDate), qtyUnits: num(r.qtyUnits),
    })),
  };
}

/** The resolved (identity + remaining + shelf) form of a batch lot. */
interface LotRow {
  id: string; locationId: string; productId: string; packSizeLitres: number; brand: string | null;
  batchNumber: string | null; expiryDate: string | null; rate: number | null; rackNo: string | null; shelfNo: string | null; binNo: string | null; qtyUnits: number;
}

/** Load lots by id (to validate a pick + carry batch/expiry/rate/shelf to a destination). */
async function fetchLots(sql: SqlClient, ids: string[]): Promise<Map<string, LotRow>> {
  const rows = await sql`
    /* fetch_lots */
    select id, location_id as "locationId", product_id as "productId", pack_size_litres as "packSizeLitres",
      brand, batch_number as "batchNumber", expiry_date as "expiryDate", rate,
      rack_no as "rackNo", shelf_no as "shelfNo", bin_no as "binNo", qty_units as "qtyUnits"
    from stock_lots where id = any(${ids}::uuid[])
  `;
  const map = new Map<string, LotRow>();
  for (const r of rows) {
    map.set(str(r.id), {
      id: str(r.id), locationId: str(r.locationId), productId: str(r.productId), packSizeLitres: num(r.packSizeLitres),
      brand: r.brand == null ? null : str(r.brand), batchNumber: r.batchNumber == null ? null : str(r.batchNumber),
      expiryDate: ymd(r.expiryDate) || null, rate: r.rate == null ? null : num(r.rate), rackNo: r.rackNo == null ? null : str(r.rackNo),
      shelfNo: r.shelfNo == null ? null : str(r.shelfNo), binNo: r.binNo == null ? null : str(r.binNo), qtyUnits: num(r.qtyUnits),
    });
  }
  return map;
}

export interface TransferLineInput extends StockLineInput {
  /** The source lot this line draws from (required — Phase 2b). */
  fromBatchId: string;
  /** Optional destination shelf overrides (default: carry the source lot's shelf). */
  destRackNo?: string | null;
  destShelfNo?: string | null;
  destBinNo?: string | null;
}

export interface TransferInput {
  fromLocationId: string;
  toLocationId: string;
  transferDate: string | null;
  note: string | null;
  lines: TransferLineInput[];
}

export async function postTransfer(sql: SqlClient, userId: string, input: TransferInput) {
  if (input.fromLocationId === input.toLocationId)
    throw new ApiError("INVALID_FIELD", "Source and destination godowns must differ.", 422);
  if (input.lines.length === 0) throw new ApiError("INVALID_FIELD", "Add at least one line.", 422);
  if (input.lines.some((l) => !l.fromBatchId)) throw new ApiError("INVALID_FIELD", "Pick a batch for every line.", 422);

  // Resolve + validate the source lots (exist at the source godown, match the
  // line's product/pack, and hold enough) before writing anything.
  const srcLots = await fetchLots(sql, [...new Set(input.lines.map((l) => l.fromBatchId))]);
  for (const l of input.lines) {
    const lot = srcLots.get(l.fromBatchId);
    if (!lot) throw new ApiError("INVALID_FIELD", "Batch not found at the source godown.", 422);
    if (lot.locationId !== input.fromLocationId || lot.productId !== l.productId || num(lot.packSizeLitres) !== num(l.packSizeLitres))
      throw new ApiError("INVALID_FIELD", "Batch not found at the source godown.", 422);
    if (Math.abs(l.qtyUnits) > lot.qtyUnits) throw stockShortError();
  }

  return retryOnUniqueViolation(async () => {
    const trfNo = await nextTransferNumber(sql);
    const trfId = crypto.randomUUID();
    // Destination lots carry the source batch/expiry/brand + shelf (editable override).
    const destLines: LotLine[] = input.lines.map((l) => {
      const s = srcLots.get(l.fromBatchId)!;
      return {
        productId: l.productId, packSizeLitres: l.packSizeLitres, brand: s.brand,
        batchNumber: s.batchNumber, expiryDate: s.expiryDate, rate: s.rate, // cost follows the goods
        rackNo: l.destRackNo ?? s.rackNo, shelfNo: l.destShelfNo ?? s.shelfNo, binNo: l.destBinNo ?? s.binNo,
      };
    });
    const destLots = await ensureLots(sql, input.toLocationId, userId, destLines, "transfer", trfId, input.transferDate);
    const destId = (l: TransferLineInput) => {
      const s = srcLots.get(l.fromBatchId)!;
      return destLots.get(lotIdentityKey({ productId: l.productId, packSizeLitres: l.packSizeLitres, brand: s.brand, batchNumber: s.batchNumber, expiryDate: s.expiryDate, rate: s.rate }))!;
    };
    const stmts = [
      sql`
        /* create_transfer */
        insert into stock_transfers (id, transfer_number, from_location_id, to_location_id, transfer_date, note, created_by)
        values (${trfId}::uuid, ${trfNo}, ${input.fromLocationId}::uuid, ${input.toLocationId}::uuid,
                coalesce(${input.transferDate}::date, (now() at time zone 'Asia/Kolkata')::date), ${input.note}, ${userId}::uuid)
      `,
      ...input.lines.map((l) => sql`
        insert into stock_transfer_items (transfer_id, product_id, pack_size_litres, brand, qty_units, from_batch_id, to_batch_id)
        values (${trfId}::uuid, ${l.productId}::uuid, ${l.packSizeLitres}, ${l.brand}, ${l.qtyUnits}, ${l.fromBatchId}::uuid, ${destId(l)}::uuid)
      `),
      ...input.lines.flatMap((l) => [
        movementStmt(sql, { locationId: input.fromLocationId, productId: l.productId, packSizeLitres: l.packSizeLitres, brand: l.brand, qtyUnits: -Math.abs(l.qtyUnits), kind: "transfer_out", refType: "transfer", refId: trfId, batchId: l.fromBatchId, note: null, movedAt: input.transferDate }, userId),
        movementStmt(sql, { locationId: input.toLocationId, productId: l.productId, packSizeLitres: l.packSizeLitres, brand: l.brand, qtyUnits: Math.abs(l.qtyUnits), kind: "transfer_in", refType: "transfer", refId: trfId, batchId: destId(l), note: null, movedAt: input.transferDate }, userId),
        balanceStmt(sql, { locationId: input.fromLocationId, productId: l.productId, packSizeLitres: l.packSizeLitres, delta: -Math.abs(l.qtyUnits) }),
        balanceStmt(sql, { locationId: input.toLocationId, productId: l.productId, packSizeLitres: l.packSizeLitres, delta: Math.abs(l.qtyUnits) }),
        lotBalanceStmt(sql, l.fromBatchId, -Math.abs(l.qtyUnits)),
        lotBalanceStmt(sql, destId(l), Math.abs(l.qtyUnits)),
      ]),
    ];
    try {
      await sql.transaction(stmts);
    } catch (err) {
      if (isBalanceUnderflow(err)) throw stockShortError();
      throw err;
    }
    return { id: trfId, transferNumber: trfNo };
  }, { constraint: "stock_transfers_transfer_number_key" });
}

export interface AdjustmentLineInput {
  productId: string; packSizeLitres: number; brand: string | null; deltaUnits: number;
  /** Required for a NEGATIVE line — the lot being reduced. */
  batchId?: string | null;
  /** Required for a POSITIVE line (corrective receipt) — the batch + expiry it creates. */
  batchNumber?: string | null; expiryDate?: string | null;
  rackNo?: string | null; shelfNo?: string | null; binNo?: string | null;
}

export interface AdjustmentInput {
  locationId: string;
  reason: string;
  note: string | null;
  adjustmentDate: string | null;
  lines: AdjustmentLineInput[];
}

export async function postAdjustment(sql: SqlClient, userId: string, input: AdjustmentInput) {
  const lines = input.lines.filter((l) => l.deltaUnits !== 0);
  if (lines.length === 0) throw new ApiError("INVALID_FIELD", "Enter at least one non-zero adjustment.", 422);
  const negs = lines.filter((l) => l.deltaUnits < 0);
  const poss = lines.filter((l) => l.deltaUnits > 0);
  if (negs.some((l) => !l.batchId)) throw new ApiError("INVALID_FIELD", "Pick a batch to reduce for every negative line.", 422);
  if (poss.some((l) => !l.batchNumber || !l.expiryDate)) throw new ApiError("INVALID_FIELD", "A positive adjustment needs a batch number and expiry.", 422);

  // Validate the lots the negative lines reduce (exist here, match, hold enough).
  const srcLots = negs.length > 0 ? await fetchLots(sql, [...new Set(negs.map((l) => l.batchId!))]) : new Map<string, LotRow>();
  for (const l of negs) {
    const lot = srcLots.get(l.batchId!);
    if (!lot) throw new ApiError("INVALID_FIELD", "Batch not found at this godown.", 422);
    if (lot.locationId !== input.locationId || lot.productId !== l.productId || num(lot.packSizeLitres) !== num(l.packSizeLitres))
      throw new ApiError("INVALID_FIELD", "Batch not found at this godown.", 422);
    if (Math.abs(l.deltaUnits) > lot.qtyUnits) throw stockShortError();
  }

  return retryOnUniqueViolation(async () => {
    const adjNo = await nextAdjustmentNumber(sql);
    const adjId = crypto.randomUUID();
    // Positive lines create-or-find their lot (a corrective receipt).
    const posLots = poss.length > 0
      ? await ensureLots(sql, input.locationId, userId, poss.map((l) => ({ productId: l.productId, packSizeLitres: l.packSizeLitres, brand: l.brand, batchNumber: l.batchNumber, expiryDate: l.expiryDate, rackNo: l.rackNo, shelfNo: l.shelfNo, binNo: l.binNo })), "adjustment", adjId, input.adjustmentDate)
      : new Map<string, string>();
    const lotIdFor = (l: AdjustmentLineInput) => l.deltaUnits < 0
      ? l.batchId!
      : posLots.get(lotIdentityKey({ productId: l.productId, packSizeLitres: l.packSizeLitres, brand: l.brand, batchNumber: l.batchNumber, expiryDate: l.expiryDate }))!;
    const stmts = [
      sql`
        /* create_adjustment */
        insert into stock_adjustments (id, adjustment_number, location_id, reason, note, adjustment_date, created_by)
        values (${adjId}::uuid, ${adjNo}, ${input.locationId}::uuid, ${input.reason}, ${input.note},
                coalesce(${input.adjustmentDate}::date, (now() at time zone 'Asia/Kolkata')::date), ${userId}::uuid)
      `,
      ...lines.map((l) => sql`
        insert into stock_adjustment_items (adjustment_id, product_id, pack_size_litres, brand, delta_units, batch_id)
        values (${adjId}::uuid, ${l.productId}::uuid, ${l.packSizeLitres}, ${l.brand}, ${l.deltaUnits}, ${lotIdFor(l)}::uuid)
      `),
      ...lines.map((l) =>
        movementStmt(sql, { locationId: input.locationId, productId: l.productId, packSizeLitres: l.packSizeLitres, brand: l.brand, qtyUnits: l.deltaUnits, kind: "adjustment", refType: "adjustment", refId: adjId, batchId: lotIdFor(l), note: input.reason, movedAt: input.adjustmentDate }, userId),
      ),
      ...lines.map((l) =>
        balanceStmt(sql, { locationId: input.locationId, productId: l.productId, packSizeLitres: l.packSizeLitres, delta: l.deltaUnits }),
      ),
      ...lines.map((l) => lotBalanceStmt(sql, lotIdFor(l), l.deltaUnits)),
    ];
    try {
      await sql.transaction(stmts);
    } catch (err) {
      if (isBalanceUnderflow(err)) throw stockShortError();
      throw err;
    }
    return { id: adjId, adjustmentNumber: adjNo };
  }, { constraint: "stock_adjustments_adjustment_number_key" });
}

export interface OpeningInput {
  locationId: string;
  openingDate: string | null;
  lines: (StockLineInput & {
    // All optional, captured at go-live; `expiryDate` feeds the near-expiry report.
    rate?: number | null;
    batchNumber?: string | null;
    expiryDate?: string | null;
    rackNo?: string | null;
    shelfNo?: string | null;
    binNo?: string | null;
  })[];
}

/** Seed opening stock at go-live: one 'opening' movement + balance per line, plus
 *  a detail row carrying batch/expiry/location (the near-expiry report reads it). */
export async function postOpening(sql: SqlClient, userId: string, input: OpeningInput) {
  const lines = input.lines.filter((l) => l.qtyUnits > 0);
  if (lines.length === 0) throw new ApiError("INVALID_FIELD", "Enter at least one opening quantity.", 422);
  if (lines.some((l) => !isPositiveRate(l.rate))) throw new ApiError("INVALID_FIELD", "Every opening line needs a rate greater than 0.", 422);
  const lots = await ensureLots(sql, input.locationId, userId, lines, "opening", null, input.openingDate);
  const lotId = (l: (typeof lines)[number]) => lots.get(lotIdentityKey(l))!;
  const stmts = [
    ...lines.map((l) => sql`
      /* create_opening_item */
      insert into opening_stock_items
        (location_id, product_id, pack_size_litres, brand, qty_units, rate, amount,
         batch_number, expiry_date, rack_no, shelf_no, bin_no, opening_date, created_by)
      values (${input.locationId}::uuid, ${l.productId}::uuid, ${l.packSizeLitres}, ${l.brand}, ${Math.abs(l.qtyUnits)},
              ${l.rate ?? null}, ${l.rate == null ? null : round2(l.rate * Math.abs(l.qtyUnits))},
              ${l.batchNumber ?? null}, ${l.expiryDate ?? null}::date, ${l.rackNo ?? null}, ${l.shelfNo ?? null}, ${l.binNo ?? null},
              coalesce(${input.openingDate}::date, (now() at time zone 'Asia/Kolkata')::date), ${userId}::uuid)
    `),
    ...lines.map((l) =>
      movementStmt(sql, { locationId: input.locationId, productId: l.productId, packSizeLitres: l.packSizeLitres, brand: l.brand, qtyUnits: Math.abs(l.qtyUnits), kind: "opening", refType: "opening", refId: null, batchId: lotId(l), note: "Opening stock", movedAt: input.openingDate }, userId),
    ),
    ...lines.map((l) =>
      balanceStmt(sql, { locationId: input.locationId, productId: l.productId, packSizeLitres: l.packSizeLitres, delta: Math.abs(l.qtyUnits) }),
    ),
    ...lines.map((l) => lotBalanceStmt(sql, lotId(l), Math.abs(l.qtyUnits))),
  ];
  await sql.transaction(stmts);
  return { posted: lines.length };
}

/** Rebuild the stock_balances + per-lot caches from the movement ledger (admin
 *  self-heal). stock_balances is rebuilt by (location,product,pack); each lot's
 *  cached qty is recomputed from the movements attributed to it (batch_id). */
export async function recomputeBalances(sql: SqlClient) {
  await sql.transaction([
    sql`delete from stock_balances`,
    sql`
      insert into stock_balances (location_id, product_id, pack_size_litres, qty_units, updated_at)
      select location_id, product_id, pack_size_litres, sum(qty_units), now()
      from stock_movements
      group by location_id, product_id, pack_size_litres
      having sum(qty_units) <> 0
    `,
    sql`
      /* recompute_lot_balances */
      update stock_lots sl set
        qty_units = coalesce((select sum(m.qty_units) from stock_movements m where m.batch_id = sl.id), 0),
        updated_at = now()
    `,
  ]);
  return { ok: true };
}

/** Set (or clear, with null) the low-stock threshold for one SKU at one godown.
 *  Upserts the balance row so a threshold can be set before any stock exists. */
export async function setReorderLevel(
  sql: SqlClient,
  input: { locationId: string; productId: string; packSizeLitres: number; reorderLevel: number | null },
) {
  await sql`
    /* set_reorder_level */
    insert into stock_balances (location_id, product_id, pack_size_litres, qty_units, reorder_level, updated_at)
    values (${input.locationId}::uuid, ${input.productId}::uuid, ${input.packSizeLitres}, 0, ${input.reorderLevel}, now())
    on conflict (location_id, product_id, pack_size_litres)
    do update set reorder_level = ${input.reorderLevel}, updated_at = now()
  `;
  return { ok: true };
}

// ── helpers ──
function stockShortError(): ApiError {
  return new ApiError("STOCK_SHORT", "Not enough stock at this godown for one or more lines.", 409);
}

function isBalanceUnderflow(err: unknown): boolean {
  if (isUniqueViolation(err)) return false;
  const msg = String((err as { message?: string })?.message ?? "");
  return /stock_balances_nonneg/.test(msg) || /check constraint/i.test(msg);
}
