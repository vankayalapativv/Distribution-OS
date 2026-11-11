/** Client calls for generating a GST invoice (POST /invoices/generate) + the
 *  customer search that feeds its picker (GET /customers?search=). */
import { apiRequest, type ActionConfig } from "@/lib/api-client";
import type { OrderDetail } from "@/features/orders/orders-api";

/** The chosen customer, as GET /customers/:id already returns it. Only the
 *  invoice-relevant fields are typed here — the "Bill to" card reads identity,
 *  address, contact and the (ledger-accurate) credit status; the tax split still
 *  derives from `gstNumber`. */
export interface CustomerDetail {
  id: string;
  legalName: string;
  tradeName: string | null;
  customerName: string | null;
  customerCode: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  phone: string | null;
  alternativePhone: string | null;
  email: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressPincode: string | null;
  addressLandmark: string | null;
  creditLimit: number;
  creditDays: number;
  salesExecutiveName: string | null;
  // Folded in server-side by getCustomerCreditStatus — same helper the customer
  // page uses, so the figures never disagree. `creditOverdueDays` is the block
  // threshold (a system setting), not this customer's own days overdue.
  totalOutstanding: number;
  creditBlocked: boolean;
  creditOverdueDays: number;
}

/** The chosen customer's full record — drives the Bill-to card + the tax split. */
export async function fetchCustomerDetail(cfg: ActionConfig, id: string): Promise<CustomerDetail> {
  return apiRequest<CustomerDetail>(cfg, "GET", `/customers/${id}`);
}

/** Provisional number the next generated invoice will get (GET
 *  /invoices/next-number). Read-only — peeks the series without consuming it, so
 *  the real number is only locked on Generate and could differ if another invoice
 *  lands first. */
export async function fetchNextInvoiceNumber(cfg: ActionConfig): Promise<{ invoiceNumber: string; finYear: string }> {
  return apiRequest<{ invoiceNumber: string; finYear: string }>(cfg, "GET", "/invoices/next-number");
}

export interface GenerateLine {
  productId: string;
  packSizeLitres: number;
  brand: string | null;
  segment: string | null;
  hsnCode: string | null;
  qtyUnits: number;
  rate: number;
  mrp: number | null;
  discountPct: number;
  orderItemId: string | null;
}

export function generateInvoice(cfg: ActionConfig, body: {
  customerId: string;
  locationId: string;
  invoiceDate: string;
  orderId: string | null;
  placeOfSupply: string | null;
  irn: string | null;
  ewayBillNo: string | null;
  reverseCharge: boolean;
  transport: string | null;
  vehicleNo: string | null;
  grRrNo: string | null;
  station: string | null;
  transportCharge: number;
  lines: GenerateLine[];
}) {
  return apiRequest<{ invoice: { id: string; invoiceNumber: string; grandTotal: number; customerName: string } }>(
    cfg, "POST", "/invoices/generate", body,
  );
}

/** One prefilled line for the edit form (numbers as the API stores them). */
export interface EditDataLine {
  productId: string;
  productName: string;
  packSizeLitres: number;
  brand: string | null;
  segment: string | null;
  hsnCode: string | null;
  qty: number;
  rate: number;
  mrp: number | null;
  discountPct: number;
  orderItemId: string | null;
}

/** Everything the edit form needs to prefill (GET /invoices/:id/edit-data). */
export interface InvoiceEditData {
  invoiceId: string;
  invoiceNumber: string;
  editable: boolean;
  customer: { id: string; name: string };
  location: { id: string; name: string | null };
  orderId: string | null;
  header: {
    invoiceDate: string;
    placeOfSupply: string | null;
    irn: string | null;
    ewayBillNo: string | null;
    reverseCharge: boolean;
    transport: string | null;
    vehicleNo: string | null;
    grRrNo: string | null;
    station: string | null;
    transportCharge: number;
  };
  lines: EditDataLine[];
}

export function fetchInvoiceEditData(cfg: ActionConfig, invoiceId: string): Promise<InvoiceEditData> {
  return apiRequest<InvoiceEditData>(cfg, "GET", `/invoices/${invoiceId}/edit-data`);
}

/** Save an edit to a generated invoice in place (keeps the same number). */
export function editInvoice(cfg: ActionConfig, invoiceId: string, body: {
  invoiceDate: string;
  placeOfSupply: string | null;
  irn: string | null;
  ewayBillNo: string | null;
  reverseCharge: boolean;
  transport: string | null;
  vehicleNo: string | null;
  grRrNo: string | null;
  station: string | null;
  transportCharge: number;
  lines: GenerateLine[];
}) {
  return apiRequest<{ invoice: { id: string; invoiceNumber: string; grandTotal: number; customerName: string } }>(
    cfg, "PATCH", `/invoices/${invoiceId}/generated`, body,
  );
}

/** A line as held in the New-Invoice form (qty + rate are strings while typing). */
export interface InvoiceFormLine {
  /** Stable client id — rows start as empty drafts (no productId yet) and the
   *  cascading pickers fill them in, so React keys can't use productId|pack. */
  uid: string;
  productId: string;
  productName: string;
  packSizeLitres: number;
  brand: string | null;
  segment: string | null;
  hsnCode: string | null;
  qty: string;
  rate: string;
  mrp: string;
  discountPct: string;
  orderItemId: string | null;
  /** For an order-linked line, the units still billable (ordered − already
   *  invoiced); null for an ad-hoc line, which has no order cap. */
  maxUnits: number | null;
}

/** One pre-filled invoice line seeded from an order item (rate is left blank —
 *  orders carry quantity, not price). `orderItemId` links the invoice line back
 *  to the order for allocation + fulfillment recompute. */
export interface SeedLine {
  productId: string;
  productName: string;
  packSizeLitres: number;
  brand: string | null;
  segment: string | null;
  hsnCode: string | null;
  qty: string;
  orderItemId: string;
  /** Units still billable on the order (ordered − already invoiced) = the cap. */
  remainingUnits: number;
}

/** Everything the New-Invoice form pre-fills when opened from an order. */
export interface OrderInvoiceSeed {
  orderId: string;
  orderCode: string;
  customerId: string;
  customerName: string | null;
  lines: SeedLine[];
}

/** Map an order's detail to the invoice form seed: its customer + one line per
 *  oil item, quantity defaulting to the still-un-invoiced remainder. Lines with
 *  no catalogue product or pack size, or nothing left to bill, are dropped. */
export function orderToInvoiceSeed(order: OrderDetail): OrderInvoiceSeed {
  const lines: SeedLine[] = order.items
    .filter((it) => it.productId && it.packSizeLitres != null)
    .map((it) => {
      const remaining = order.skuProgress.find((sp) => sp.orderItemId === it.id)?.remainingUnits;
      // Use the remaining-to-bill even when it is 0 (a fully-invoiced line) — the
      // `> 0` filter below then drops it and the over-bill guard (maxUnits) stays
      // correct. Only fall back to the full ordered qty when there's NO progress
      // info for this line at all. (`remaining > 0` here would seed a
      // fully-invoiced line at full qty and let a duplicate invoice be generated.)
      const cap = remaining != null ? remaining : it.quantityUnits;
      return {
        productId: it.productId as string,
        productName: it.productName ?? "",
        packSizeLitres: it.packSizeLitres as number,
        brand: it.brand,
        segment: it.segment,
        hsnCode: it.hsnCode,
        qty: String(cap),
        orderItemId: it.id,
        remainingUnits: cap,
      };
    })
    .filter((l) => Number(l.qty) > 0);
  return {
    orderId: order.id,
    orderCode: order.orderCode,
    customerId: order.customerId ?? "",
    customerName: order.customerName ?? null,
    lines,
  };
}

/** The New-Invoice form's starting lines: one per edited invoice line, or one per
 *  seeded (un-invoiced) order line, or none. Pure (apart from the per-row uid). */
export function initialFormLines(edit?: InvoiceEditData | null, seed?: OrderInvoiceSeed | null): InvoiceFormLine[] {
  if (edit) {
    return edit.lines.map((l) => ({
      uid: crypto.randomUUID(), productId: l.productId, productName: l.productName, packSizeLitres: l.packSizeLitres,
      brand: l.brand, segment: l.segment, hsnCode: l.hsnCode,
      qty: String(l.qty), rate: String(l.rate), mrp: l.mrp != null ? String(l.mrp) : "",
      discountPct: String(l.discountPct), orderItemId: l.orderItemId, maxUnits: null,
    }));
  }
  return (seed?.lines ?? []).map((l) => ({
    uid: crypto.randomUUID(), productId: l.productId, productName: l.productName, packSizeLitres: l.packSizeLitres,
    brand: l.brand, segment: l.segment, hsnCode: l.hsnCode, qty: l.qty, rate: "", mrp: "", discountPct: "0",
    orderItemId: l.orderItemId, maxUnits: l.remainingUnits,
  }));
}

/** The generate/edit payload: only complete, priced lines, as the API shape. Pure. */
export function toGenerateLines(lines: InvoiceFormLine[]): GenerateLine[] {
  const n = (v: string) => Number(v) || 0;
  return lines
    .filter((l) => l.productId && l.packSizeLitres > 0 && n(l.qty) > 0 && l.rate.trim() !== "")
    .map((l) => ({
      productId: l.productId, packSizeLitres: l.packSizeLitres, brand: l.brand, segment: l.segment, hsnCode: l.hsnCode,
      qtyUnits: n(l.qty), rate: n(l.rate), mrp: l.mrp.trim() ? n(l.mrp) : null, discountPct: n(l.discountPct), orderItemId: l.orderItemId,
    }));
}

/** Company GST state (Telangana) — intra-state when the buyer matches, else inter. */
export const COMPANY_STATE_CODE = "36";
export const GST_RATE = 18;
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Supply type from a buyer's GSTIN (first two digits = state code). No GSTIN → intra. */
export function supplyTypeOf(gstNumber: string | null): "intra" | "inter" {
  const code = gstNumber && gstNumber.length >= 2 ? gstNumber.slice(0, 2) : COMPANY_STATE_CODE;
  return code === COMPANY_STATE_CODE ? "intra" : "inter";
}

/** On-hand at the chosen godown for exactly the SKUs on screen (GET
 *  /stock/balances/for-skus). Returns a Map keyed `productId|packSizeLitres`, so
 *  each invoice line can show "N in stock" and flag a short quantity BEFORE
 *  generate (the server hard-block stays the backstop). */
export async function fetchBalancesForSkus(
  cfg: ActionConfig,
  locationId: string,
  skus: { productId: string; packSizeLitres: number }[],
): Promise<Map<string, number>> {
  if (!locationId || skus.length === 0) return new Map();
  const param = skus.map((s) => `${s.productId}:${s.packSizeLitres}`).join(",");
  const sp = new URLSearchParams({ locationId, skus: param });
  const data = await apiRequest<{ balances: { productId: string; packSizeLitres: number; qtyUnits: number }[] }>(
    cfg, "GET", `/stock/balances/for-skus?${sp}`,
  );
  const map = new Map<string, number>();
  for (const b of data.balances) map.set(`${b.productId}|${b.packSizeLitres}`, b.qtyUnits);
  return map;
}

/** Per-line taxable + GST split at 18% (CGST/SGST intra-state, else IGST).
 *  Discount % reduces the taxable; MRP is printed only, never in the math. */
export function lineTax(qty: number, rate: number, supply: "intra" | "inter", discountPct = 0) {
  const disc = Math.min(100, Math.max(0, discountPct || 0));
  const taxable = round2(qty * rate * (1 - disc / 100));
  const gst = round2((taxable * GST_RATE) / 100);
  const cgst = supply === "intra" ? round2(gst / 2) : 0;
  const sgst = supply === "intra" ? round2(gst - cgst) : 0;
  const igst = supply === "inter" ? gst : 0;
  return { taxable, gst, cgst, sgst, igst, lineTotal: round2(taxable + gst) };
}
