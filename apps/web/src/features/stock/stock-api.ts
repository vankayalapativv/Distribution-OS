/** Types + client calls for the Stock Journal (backed by GET/POST /stock/*). */
import { apiRequest, type ActionConfig } from "@/lib/api-client";

/** How a product is sold. Piece-sold products carry a sentinel pack of 1. */
export type StockUnit = "litres" | "quantity";

/** The pack label for a SKU/line: "5 L" for litres, "pcs" for piece-sold.
 *  Pack sizes can be sub-litre (e.g. 0.037 L) — show the exact value (like the
 *  catalogue), not a 1-decimal rounding that would render it "0.0 L". */
export function packLabel(packSizeLitres: number, unit: StockUnit): string {
  if (unit === "quantity") return "pcs";
  const s = Number.isInteger(packSizeLitres) ? String(packSizeLitres) : String(Number(packSizeLitres.toFixed(3)));
  return `${s} L`;
}

export interface StockLocation {
  id: string;
  name: string;
  code: string | null;
  city: string | null;
  state: string;
  stateCode: string;
  isDefault: boolean;
  status: string;
  skuCount: number;
  totalLitres: number;
}

export interface Sku {
  productId: string;
  productName: string;
  brand: string | null;
  hsnCode: string | null;
  packSizeLitres: number;
  unit: StockUnit;
  segment: string | null;
}

export interface BalanceRow {
  locationId: string;
  locationName: string;
  productId: string;
  productName: string;
  brand: string | null;
  segment: string | null;
  packSizeLitres: number;
  unit: StockUnit;
  qtyUnits: number;
  litres: number;
  reorderLevel: number | null;
  belowReorder: boolean;
}

export interface MovementRow {
  id: string;
  kind: "opening" | "grn" | "sale" | "sale_reversal" | "transfer_in" | "transfer_out" | "adjustment";
  qtyUnits: number;
  litres: number;
  packSizeLitres: number;
  productName: string;
  brand: string | null;
  locationName: string;
  refType: string | null;
  refId: string | null;
  note: string | null;
  movedAt: string;
}

export interface Paged<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export async function fetchLocations(cfg: ActionConfig): Promise<StockLocation[]> {
  const data = await apiRequest<{ locations: StockLocation[] }>(cfg, "GET", "/stock/locations");
  return data.locations;
}

export async function fetchSkus(cfg: ActionConfig, search: string): Promise<Sku[]> {
  const q = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
  const data = await apiRequest<{ skus: Sku[] }>(cfg, "GET", `/stock/skus${q}`);
  return data.skus;
}

/** Catalogue brand names (live from SKUs) — the GRN supplier dropdown. */
export async function fetchBrands(cfg: ActionConfig): Promise<string[]> {
  const data = await apiRequest<{ brands: string[] }>(cfg, "GET", "/brands?category=oils");
  return data.brands;
}

/** On-hand units for a set of SKUs at one godown → map of `${productId}|${pack}`
 *  to qty. Drives the Transfer/Adjustment-out client-side hard block. */
export async function fetchOnHand(
  cfg: ActionConfig,
  locationId: string,
  skus: { productId: string; packSizeLitres: number }[],
): Promise<Map<string, number>> {
  if (!locationId || skus.length === 0) return new Map();
  const skuParam = skus.map((s) => `${s.productId}:${s.packSizeLitres}`).join(",");
  const data = await apiRequest<{ balances: { productId: string; packSizeLitres: number; qtyUnits: number }[] }>(
    cfg, "GET", `/stock/balances/for-skus?locationId=${locationId}&skus=${encodeURIComponent(skuParam)}`,
  );
  const map = new Map<string, number>();
  for (const b of data.balances) map.set(`${b.productId}|${b.packSizeLitres}`, b.qtyUnits);
  return map;
}

export async function fetchBalances(
  cfg: ActionConfig,
  f: { locationId?: string; search?: string; lowOnly?: boolean; page: number; pageSize: number },
): Promise<Paged<BalanceRow>> {
  const sp = new URLSearchParams();
  if (f.locationId) sp.set("locationId", f.locationId);
  if (f.search) sp.set("search", f.search);
  if (f.lowOnly) sp.set("lowOnly", "1");
  sp.set("page", String(f.page));
  sp.set("pageSize", String(f.pageSize));
  return apiRequest<Paged<BalanceRow>>(cfg, "GET", `/stock/balances?${sp}`);
}

export interface BalancesSummary { skuCount: number; totalLitres: number; belowReorder: number }
export function fetchBalancesSummary(cfg: ActionConfig, locationId?: string): Promise<BalancesSummary> {
  const q = locationId ? `?locationId=${locationId}` : "";
  return apiRequest<BalancesSummary>(cfg, "GET", `/stock/balances/summary${q}`);
}

/** Per-godown on-hand breakdown — drives the stat-card drill-down popups. */
export interface GodownBreakdownRow { locationId: string; locationName: string; skuCount: number; units: number; litres: number }
export async function fetchGodownBreakdown(cfg: ActionConfig): Promise<GodownBreakdownRow[]> {
  return (await apiRequest<{ rows: GodownBreakdownRow[] }>(cfg, "GET", "/stock/summary/by-godown")).rows;
}

export interface GrnDoc { id: string; docNumber: string; date: string; party: string; reference: string | null; locationName: string; value: number; lineCount: number; status: string }
export interface TransferDoc { id: string; docNumber: string; date: string; route: string; lineCount: number; status: string }
export interface AdjustmentDoc { id: string; docNumber: string; date: string; reason: string; note: string | null; locationName: string; lineCount: number }

function docQuery<T>(path: string) {
  return (cfg: ActionConfig, f: { locationId?: string; page: number; pageSize: number }) => {
    const sp = new URLSearchParams();
    if (f.locationId) sp.set("locationId", f.locationId);
    sp.set("page", String(f.page));
    sp.set("pageSize", String(f.pageSize));
    return apiRequest<Paged<T>>(cfg, "GET", `${path}?${sp}`);
  };
}
/** Invoice stock events (sale / reversal / return) for the Recent-activity feed. */
export interface InvoiceActivityRow {
  invoiceId: string; kind: "sale" | "reversal" | "return"; invoiceNumber: string; customerName: string | null;
  locationName: string; locationId: string; units: number; lineCount: number; value: number | null; movedAt: string;
}
export async function fetchInvoiceActivity(cfg: ActionConfig, f: { locationId?: string; limit?: number }): Promise<InvoiceActivityRow[]> {
  const sp = new URLSearchParams();
  if (f.locationId) sp.set("locationId", f.locationId);
  if (f.limit != null) sp.set("limit", String(f.limit));
  const q = sp.toString();
  return (await apiRequest<{ rows: InvoiceActivityRow[] }>(cfg, "GET", `/stock/invoice-activity${q ? `?${q}` : ""}`)).rows;
}

export interface InvoiceStockLotLine { productName: string; packSizeLitres: number; unit: StockUnit; batchNumber: string | null; expiryDate: string | null; qtyUnits: number }
export interface InvoiceStockDetail { kind: "sale" | "reversal" | "return"; invoiceNumber: string; invoiceDate: string; customerName: string | null; locationName: string | null; lines: InvoiceStockLotLine[] }
export async function fetchInvoiceStockLots(cfg: ActionConfig, invoiceId: string, kind: "sale" | "reversal" | "return"): Promise<InvoiceStockDetail> {
  return (await apiRequest<{ detail: InvoiceStockDetail }>(cfg, "GET", `/stock/invoice-lots?invoiceId=${encodeURIComponent(invoiceId)}&kind=${kind}`)).detail;
}

export const fetchGrns = docQuery<GrnDoc>("/stock/grn");
export const fetchTransfers = docQuery<TransferDoc>("/stock/transfers");
export const fetchAdjustments = docQuery<AdjustmentDoc>("/stock/adjustments");

// ── Single-document detail (row-click drawers) ──
export interface GrnDetailLine {
  productName: string; packSizeLitres: number; unit: StockUnit; brand: string | null; qtyUnits: number; rate: number | null; amount: number | null;
  batchNumber: string | null; expiryDate: string | null; rackNo: string | null; shelfNo: string | null; binNo: string | null;
}
export interface GrnDetail { id: string; docNumber: string; date: string; supplierName: string; supplierInvoiceNo: string | null; locationName: string; totalValue: number; status: string; note: string | null; lines: GrnDetailLine[] }
export interface TransferDetailLine { productName: string; packSizeLitres: number; unit: StockUnit; brand: string | null; qtyUnits: number }
export interface TransferDetail { id: string; docNumber: string; date: string; status: string; fromName: string; toName: string; note: string | null; lines: TransferDetailLine[] }
export interface AdjustmentDetailLine { productName: string; packSizeLitres: number; unit: StockUnit; brand: string | null; deltaUnits: number }
export interface AdjustmentDetail { id: string; docNumber: string; date: string; reason: string; locationName: string; note: string | null; lines: AdjustmentDetailLine[] }

export async function fetchGrnDetail(cfg: ActionConfig, id: string): Promise<GrnDetail> {
  return (await apiRequest<{ grn: GrnDetail }>(cfg, "GET", `/stock/grn/${id}`)).grn;
}
export async function fetchTransferDetail(cfg: ActionConfig, id: string): Promise<TransferDetail> {
  return (await apiRequest<{ transfer: TransferDetail }>(cfg, "GET", `/stock/transfers/${id}`)).transfer;
}
export async function fetchAdjustmentDetail(cfg: ActionConfig, id: string): Promise<AdjustmentDetail> {
  return (await apiRequest<{ adjustment: AdjustmentDetail }>(cfg, "GET", `/stock/adjustments/${id}`)).adjustment;
}

export async function fetchMovements(
  cfg: ActionConfig,
  f: { locationId?: string; kind?: string; page: number; pageSize: number },
): Promise<Paged<MovementRow>> {
  const sp = new URLSearchParams();
  if (f.locationId) sp.set("locationId", f.locationId);
  if (f.kind) sp.set("kind", f.kind);
  sp.set("page", String(f.page));
  sp.set("pageSize", String(f.pageSize));
  return apiRequest<Paged<MovementRow>>(cfg, "GET", `/stock/movements?${sp}`);
}

export interface GrnLine {
  productId: string; packSizeLitres: number; brand: string | null; qtyUnits: number; rate: number | null;
  // Optional stock-in details.
  batchNumber: string | null; expiryDate: string | null; rackNo: string | null; shelfNo: string | null; binNo: string | null;
}
export function postGrn(cfg: ActionConfig, body: {
  locationId: string; supplierName: string; supplierInvoiceNo: string | null;
  supplierInvoiceDate: string | null; receivedDate: string | null; reference: string | null;
  note: string | null; lines: GrnLine[];
}) {
  return apiRequest<{ grn: { id: string; grnNumber: string; totalValue: number } }>(cfg, "POST", "/stock/grn", body);
}

/** A received batch nearing expiry (advisory FEFO — "sell these first"). */
export interface NearExpiryRow {
  id: string; productName: string; packSizeLitres: number; unit: StockUnit; brand: string | null;
  batchNumber: string | null; expiryDate: string; rate: number | null; qtyUnits: number;
  rackNo: string | null; shelfNo: string | null; binNo: string | null;
  grnNumber: string; receivedDate: string; supplierName: string;
  locationId: string; locationName: string; daysToExpiry: number; onHandQty: number;
}
export async function fetchNearExpiry(
  cfg: ActionConfig,
  f: { locationId?: string; withinDays?: number | null },
): Promise<NearExpiryRow[]> {
  const sp = new URLSearchParams();
  if (f.locationId) sp.set("locationId", f.locationId);
  if (f.withinDays != null) sp.set("withinDays", String(f.withinDays));
  const suffix = sp.toString() ? `?${sp}` : "";
  return (await apiRequest<{ rows: NearExpiryRow[] }>(cfg, "GET", `/stock/near-expiry${suffix}`)).rows;
}

// ── Stock lookup (quick popup: on-hand + batches + movements for one product) ──
export interface LookupBalance { locationName: string; packSizeLitres: number; unit: StockUnit; qtyUnits: number; litres: number; reorderLevel: number | null; belowReorder: boolean }
export interface LookupBatch {
  id: string; packSizeLitres: number; unit: StockUnit; batchNumber: string | null; expiryDate: string | null; rate: number | null;
  rackNo: string | null; shelfNo: string | null; binNo: string | null; qtyUnits: number;
  locationName: string; receivedDate: string; source: string; daysToExpiry: number | null;
}
export interface StockLookup {
  product: { id: string; productName: string; brand: string | null; segment: string | null; unit: StockUnit };
  balances: LookupBalance[];
  totals: { qtyUnits: number; litres: number };
  batches: LookupBatch[];
  movements: MovementRow[];
}
export async function fetchStockLookup(cfg: ActionConfig, productId: string): Promise<StockLookup> {
  return (await apiRequest<{ lookup: StockLookup }>(cfg, "GET", `/stock/lookup?productId=${encodeURIComponent(productId)}`)).lookup;
}

/** An on-hand batch lot at a godown (the Transfer/Adjust batch picker). */
export interface Lot {
  id: string; packSizeLitres: number; batchNumber: string | null; expiryDate: string | null; rate: number | null;
  rackNo: string | null; shelfNo: string | null; binNo: string | null;
  qtyUnits: number; receivedDate: string; source: string; daysToExpiry: number | null;
}
export async function fetchAvailableLots(
  cfg: ActionConfig,
  f: { locationId: string; productId: string; packSizeLitres?: number | null },
): Promise<Lot[]> {
  const sp = new URLSearchParams({ locationId: f.locationId, productId: f.productId });
  if (f.packSizeLitres != null) sp.set("packSizeLitres", String(f.packSizeLitres));
  return (await apiRequest<{ lots: Lot[] }>(cfg, "GET", `/stock/lots?${sp}`)).lots;
}

export interface MoveLine {
  productId: string; packSizeLitres: number; brand: string | null; qtyUnits: number;
  fromBatchId: string; destRackNo?: string | null; destShelfNo?: string | null; destBinNo?: string | null;
}
export function postTransfer(cfg: ActionConfig, body: {
  fromLocationId: string; toLocationId: string; transferDate: string | null; note: string | null; lines: MoveLine[];
}) {
  return apiRequest<{ transfer: { id: string; transferNumber: string } }>(cfg, "POST", "/stock/transfers", body);
}

export interface AdjLine {
  productId: string; packSizeLitres: number; brand: string | null; deltaUnits: number;
  batchId?: string | null; batchNumber?: string | null; expiryDate?: string | null;
  rackNo?: string | null; shelfNo?: string | null; binNo?: string | null;
}
export function postAdjustment(cfg: ActionConfig, body: {
  locationId: string; reason: string; note: string | null; adjustmentDate: string | null; lines: AdjLine[];
}) {
  return apiRequest<{ adjustment: { id: string; adjustmentNumber: string } }>(cfg, "POST", "/stock/adjustments", body);
}

/** Opening line — qty plus the same optional batch/expiry/location as a stock-in. */
export interface OpeningLine {
  productId: string; packSizeLitres: number; brand: string | null; qtyUnits: number; rate?: number | null;
  batchNumber: string | null; expiryDate: string | null; rackNo: string | null; shelfNo: string | null; binNo: string | null;
}
export function postOpening(cfg: ActionConfig, body: { locationId: string; openingDate: string | null; lines: OpeningLine[] }) {
  return apiRequest<{ posted: number }>(cfg, "POST", "/stock/opening", body);
}

export function setReorder(cfg: ActionConfig, body: {
  locationId: string; productId: string; packSizeLitres: number; reorderLevel: number | null;
}) {
  return apiRequest<{ ok: boolean }>(cfg, "PUT", "/stock/reorder", body);
}

export function createLocation(cfg: ActionConfig, body: {
  name: string; code: string | null; city: string | null; stateCode: string | null; isDefault: boolean;
}) {
  return apiRequest<{ location: StockLocation }>(cfg, "POST", "/stock/locations", body);
}

/** Rename a godown (name only — other fields untouched). */
export function renameLocation(cfg: ActionConfig, id: string, name: string) {
  return apiRequest<{ location: StockLocation }>(cfg, "PATCH", `/stock/locations/${id}/rename`, { name });
}
