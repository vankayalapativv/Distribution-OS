/**
 * In-system GST invoice generation (migration 0004).
 *
 * Generates a tax invoice: allocates a gap-free number from `invoice_series`
 * (one per financial year), computes the CGST+SGST (intra-Telangana) or IGST
 * (inter-state) split at 18%, writes the invoice + structured `invoice_items`,
 * and deducts stock from the chosen godown — all in one batch. Short stock is
 * HARD-BLOCKED (pre-check + the non-negative balance CHECK backstop). Cancelling
 * reverses the stock and re-opens any linked order.
 *
 * Uploaded/parsed invoices still use services/invoices.ts (line_items jsonb);
 * this path owns the `invoice_source = 'generated'` rows.
 */
import type { SqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";
import { retryOnUniqueViolation } from "../lib/pg-errors";
import { recomputeOrderFulfillment } from "./fulfillment";
import { recomputeCustomerBalances } from "./reconcile-recompute";
import { getSystemSettings } from "./system-settings";
import { nextOrderCode, num, str } from "./orders-shared";
import { buildInvoiceDoc, type PdfData } from "@distribution-os/shared";
import { balanceStmt, COMPANY_STATE_CODE, finYearOf, lotBalanceStmt, movementStmt, round2 } from "./stock-shared";
import { allocateSaleFefo, currentSaleLots, fefoSplit, getBalancesForSkus, listAvailableLots } from "./stock";

const GST_RATE = 18;

/** Cost of goods sold for one invoice line: Σ qty × the FEFO-drawn lot's rate.
 *  NULL when any lot the line drew from is unpriced, so a margin report can tell
 *  "cost unknown" apart from a genuine zero. */
function lineCogs(allocs: { qty: number; rate: number | null }[]): number | null {
  if (allocs.some((a) => a.rate == null)) return null;
  return round2(allocs.reduce((s, a) => s + a.qty * (a.rate ?? 0), 0));
}

export interface GenerateLineInput {
  productId: string;
  packSizeLitres: number;
  brand: string | null;
  segment: string | null;
  hsnCode: string | null;
  qtyUnits: number;
  rate: number; // entered at invoice time (selling price, pre-GST)
  mrp: number | null; // printed reference only — does NOT affect the math
  discountPct: number; // 0–100; reduces the taxable (rate * qty * (1 - d/100))
  orderItemId: string | null;
}

export interface GenerateInvoiceInput {
  customerId: string;
  locationId: string;
  invoiceDate: string; // yyyy-mm-dd
  orderId: string | null;
  placeOfSupply: string | null;
  irn: string | null;
  ewayBillNo: string | null;
  // Whether this invoice is raised under reverse charge (prints Y/N).
  reverseCharge: boolean;
  // Logistics fields printed on the BAL-style invoice (all optional).
  transport: string | null;
  vehicleNo: string | null;
  grRrNo: string | null;
  station: string | null;
  // Transportation charge billed to the customer (Porter/Rapido/etc.) — added
  // directly to the grand total, no GST. 0 when none.
  transportCharge: number;
  lines: GenerateLineInput[];
}

interface Computed {
  lines: (GenerateLineInput & { taxable: number; cgst: number; sgst: number; igst: number; lineTotal: number })[];
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  gst: number;
  transportCharge: number;
  grand: number;
  totalLitres: number;
  totalDiscount: number;
  supplyType: "intra" | "inter";
}

/** Apply the 18% split to every line and total it. The transportation charge is
 *  added to the grand total as-is (no GST on it). */
function compute(lines: GenerateLineInput[], supplyType: "intra" | "inter", transportCharge = 0): Computed {
  const out = lines.map((l) => {
    const disc = Math.min(100, Math.max(0, l.discountPct || 0));
    const taxable = round2(l.qtyUnits * l.rate * (1 - disc / 100));
    const gst = round2((taxable * GST_RATE) / 100);
    const cgst = supplyType === "intra" ? round2(gst / 2) : 0;
    const sgst = supplyType === "intra" ? round2(gst - cgst) : 0;
    const igst = supplyType === "inter" ? gst : 0;
    return { ...l, taxable, cgst, sgst, igst, lineTotal: round2(taxable + cgst + sgst + igst) };
  });
  const sum = (f: (x: (typeof out)[number]) => number) => round2(out.reduce((s, x) => s + f(x), 0));
  const taxable = sum((x) => x.taxable);
  const cgst = sum((x) => x.cgst);
  const sgst = sum((x) => x.sgst);
  const igst = sum((x) => x.igst);
  const gst = round2(cgst + sgst + igst);
  const transport = round2(Math.max(0, transportCharge || 0));
  const grand = round2(taxable + gst + transport);
  const totalLitres = round2(lines.reduce((s, l) => s + l.qtyUnits * l.packSizeLitres, 0));
  const totalDiscount = round2(lines.reduce((s, l) => s + l.qtyUnits * l.rate * (Math.min(100, Math.max(0, l.discountPct || 0)) / 100), 0));
  return { lines: out, taxable, cgst, sgst, igst, gst, transportCharge: transport, grand, totalLitres, totalDiscount, supplyType };
}

const DEFAULT_INVOICE_PREFIX = "SA/";
const todayYmd = () => new Date().toISOString().slice(0, 10);

/** The configured invoice-number prefix (system_settings `invoice_number_prefix`),
 *  default 'SA/'. The number is `<prefix><fin-year>/<zero-padded seq>`. */
export async function getInvoiceNumberPrefix(sql: SqlClient): Promise<string> {
  const [r] = await sql`select value from system_settings where key = 'invoice_number_prefix'`;
  const v = r?.value ? String(r.value).trim() : "";
  return v || DEFAULT_INVOICE_PREFIX;
}

export interface InvoiceNumberConfig {
  prefix: string;
  finYear: string;
  nextNumber: number;
  padWidth: number;
}

/** Current prefix + the next sequence that will be issued this financial year. */
export async function getInvoiceNumberConfig(sql: SqlClient): Promise<InvoiceNumberConfig> {
  const prefix = await getInvoiceNumberPrefix(sql);
  const finYear = finYearOf(todayYmd());
  const [s] = await sql`
    /* invoice_series_current */
    select next_seq as "nextSeq", pad_width as "padWidth"
    from invoice_series where prefix = ${prefix} and fin_year = ${finYear}
  `;
  return { prefix, finYear, nextNumber: s ? num(s.nextSeq) : 1, padWidth: s ? num(s.padWidth) : 5 };
}

/** The number the NEXT generated invoice will most likely get, formatted exactly
 *  as allocation does (`<prefix><fin-year>/<zero-padded seq>`). Read-only — it
 *  peeks `invoice_series` without bumping it, so the value is provisional: the
 *  real number is only locked when Generate atomically allocates it, and could
 *  differ if another invoice is created first. */
export async function getNextInvoiceNumberPreview(sql: SqlClient): Promise<{ invoiceNumber: string; finYear: string }> {
  const { prefix, finYear, nextNumber, padWidth } = await getInvoiceNumberConfig(sql);
  return { invoiceNumber: `${prefix}${finYear}/${String(nextNumber).padStart(padWidth, "0")}`, finYear };
}

/** Set the prefix + the next number to issue (current financial year). A prefix
 *  change that has no series row yet is seeded at `nextNumber`. */
export async function setInvoiceNumberConfig(sql: SqlClient, input: { prefix: string; nextNumber: number }): Promise<void> {
  const prefix = input.prefix.trim() || DEFAULT_INVOICE_PREFIX;
  const finYear = finYearOf(todayYmd());
  await sql`
    insert into system_settings (key, value) values ('invoice_number_prefix', ${prefix})
    on conflict (enterprise_id, key) do update set value = excluded.value, updated_at = now()
  `;
  await sql`
    insert into invoice_series (prefix, fin_year, next_seq) values (${prefix}, ${finYear}, ${input.nextNumber})
    on conflict (enterprise_id, prefix, fin_year) do update set next_seq = excluded.next_seq, updated_at = now()
  `;
}

/** Guard: order-linked lines may not bill more than the order's remaining
 *  (ordered − already-invoiced on non-rejected invoices) per SKU. Ad-hoc lines
 *  (no orderItemId) are unconstrained. */
async function assertWithinOrderRemaining(sql: SqlClient, orderId: string | null, lines: GenerateLineInput[], excludeInvoiceId?: string) {
  const linked = lines.filter((l) => l.orderItemId);
  if (linked.length === 0) return;
  if (!orderId) throw new ApiError("INVALID_FIELD", "Order-linked lines need an order to bill against.", 422);

  const rows = await sql`
    /* generate_order_skus_remaining */
    select oi.id, coalesce(p.product_name, '') as "label",
           oi.quantity_units as "orderedUnits",
           coalesce(al.alloc, 0)::numeric as "allocatedUnits"
    from order_items oi
    join products p on p.id = oi.product_id
    left join (
      select a.order_item_id, sum(a.quantity_units) as alloc
      from invoice_line_allocations a
      join invoices iv on iv.id = a.invoice_id and iv.approval_status <> 'rejected' and iv.doc_status <> 'cancelled'
        ${excludeInvoiceId ? sql`and iv.id <> ${excludeInvoiceId}::uuid` : sql``}
      group by a.order_item_id
    ) al on al.order_item_id = oi.id
    where oi.order_id = ${orderId}::uuid and oi.product_id is not null
  `;
  const remainingById = new Map(
    rows.map((r) => [str(r.id), { label: str(r.label), remaining: num(r.orderedUnits) - num(r.allocatedUnits) }]),
  );

  const requested = new Map<string, number>();
  for (const l of linked) {
    const id = str(l.orderItemId);
    if (!remainingById.has(id))
      throw new ApiError("INVOICE_MISMATCH", "A line is linked to an item that isn't on this order. Refresh and try again.", 422);
    requested.set(id, (requested.get(id) ?? 0) + l.qtyUnits);
  }
  for (const [id, req] of requested) {
    const sku = remainingById.get(id)!;
    if (req > sku.remaining + 0.001)
      throw new ApiError(
        "INVOICE_MISMATCH",
        `"${sku.label}" is over-invoiced: ${req} on this invoice but only ${sku.remaining} left on the order.`,
        422,
      );
  }
}

/** Shared line validation for generate + edit: at least one line, each with a
 *  positive quantity and a non-negative rate. */
function validateGenerateLines(lines: GenerateLineInput[] | undefined) {
  if (!lines || lines.length === 0) throw new ApiError("INVALID_FIELD", "Add at least one line.", 422);
  for (const l of lines) {
    if (l.qtyUnits <= 0) throw new ApiError("INVALID_FIELD", "Every line needs a quantity greater than zero.", 422);
    if (l.rate < 0) throw new ApiError("INVALID_FIELD", "Every line needs a rate.", 422);
  }
}

/** The SE to attribute the invoice to for the mobile feed/notification: the linked
 *  order's SE, else the customer's creating SE (customers.created_by holding the
 *  SALES_EXECUTIVE role). */
async function resolveSalesExecutive(
  sql: SqlClient,
  input: GenerateInvoiceInput,
  cust: Record<string, unknown>,
): Promise<string | null> {
  let seId: string | null = null;
  if (input.orderId) {
    const [o] = await sql`select sales_executive_id as "seId" from orders where id = ${input.orderId}::uuid`;
    const v = o?.seId; seId = typeof v === "string" && v ? v : null;
  }
  if (!seId && cust.createdBy) {
    const [u] = await sql`
      /* invoice_se_from_customer */
      select u.id from users u
      join user_roles ur on ur.user_id = u.id
      join roles r on r.id = ur.role_id
      where u.id = ${str(cust.createdBy)}::uuid and r.code = 'SALES_EXECUTIVE'
      limit 1
    `;
    seId = u ? str(u.id) : null;
  }
  return seId;
}

interface AllocateInvoiceArgs {
  prefix: string;
  fy: string;
  input: GenerateInvoiceInput;
  cust: Record<string, unknown>;
  c: Computed;
  creditDays: number;
  userId: string;
  supplyType: "intra" | "inter";
  buyerStateCode: string;
  seId: string | null;
  partyPhone: string | null;
}

/** Allocate a gap-free number and write the invoice + items + stock deductions in
 *  one batch. Runs inside retryOnUniqueViolation; rolls the number back if the
 *  batch fails so a failed generate leaves no gap in the series. */
async function allocateAndInsertInvoice(sql: SqlClient, a: AllocateInvoiceArgs) {
  const { prefix, fy, input, cust, c, creditDays, userId, supplyType, buyerStateCode, seId, partyPhone } = a;
  // FEFO-allocate each line across lots BEFORE touching the series, so a short
  // stock throws STOCK_SHORT without leaking an invoice number.
  const saleAllocs = await Promise.all(c.lines.map((l) =>
    allocateSaleFefo(sql, { locationId: input.locationId, productId: l.productId, packSizeLitres: l.packSizeLitres, qtyUnits: l.qtyUnits })));
  // Allocate a gap-free number (find-or-create the FY series, then atomic bump).
  await sql`insert into invoice_series (prefix, fin_year) values (${prefix}, ${fy}) on conflict (enterprise_id, prefix, fin_year) do nothing`;
  const [s] = await sql`
    /* allocate_invoice_number */
    update invoice_series set next_seq = next_seq + 1, updated_at = now()
    where prefix = ${prefix} and fin_year = ${fy}
    returning id, (next_seq - 1) as seq, pad_width as "padWidth"
  `;
  const seq = num(s.seq);
  const invoiceNumber = `${prefix}${fy}/${String(seq).padStart(num(s.padWidth), "0")}`;
  const invoiceId = crypto.randomUUID();

  // A directly-generated (ad-hoc) invoice has no order behind it. Create a backing
  // order (origin='invoice') so that order_id and invoice_line_allocations ALWAYS
  // exist — which is what sales returns, order-based reports and SE order
  // attribution key off. The backing order mirrors the invoice: same date, same
  // resolved SE, one order line per invoice line. A generate-from-order invoice
  // keeps its real order untouched.
  const isBacking = !input.orderId;
  const backingOrderId = isBacking ? crypto.randomUUID() : null;
  const orderId = input.orderId ?? backingOrderId!;
  // The order_item id each invoice line maps to: for a backing order, a fresh id
  // per line generated here (explicit, so the allocation inserts can reference it
  // inside the same batch — the Neon driver can't read a generated id mid-txn);
  // for a real order, the caller's own order-item link (may be null for ad-hoc
  // lines on a mixed order, unchanged from before).
  const lineOrderItemId: (string | null)[] = c.lines.map((l) => (isBacking ? crypto.randomUUID() : l.orderItemId));

  // ORD-#### = max(seq)+1, which races under concurrent creates; it is recomputed
  // on every retry (the caller retries this fn on an orders_order_code_key clash).
  // Shared with the field/web order path via nextOrderCode.
  const backingOrderCode = isBacking ? await nextOrderCode(sql) : null;

  const backingOrderStmts = isBacking
    ? [
        sql`
          /* generate_invoice_backing_order */
          insert into orders (
            id, order_code, order_date, customer_id, sales_executive_id,
            total_litres, order_status, approval_status, origin, created_by
          ) values (
            ${backingOrderId}::uuid, ${backingOrderCode}, ${input.invoiceDate}::date, ${input.customerId}::uuid,
            ${seId ? sql`${seId}::uuid` : sql`null`},
            ${c.totalLitres}, 'approved', 'approved', 'invoice', ${userId}::uuid
          )
        `,
        ...c.lines.map((l, i) => sql`
          /* generate_invoice_backing_order_item */
          insert into order_items (id, order_id, product_id, brand, quantity_units, pack_size_litres, total_litres, segment)
          values (${lineOrderItemId[i]}::uuid, ${backingOrderId}::uuid, ${l.productId}::uuid, ${l.brand}, ${l.qtyUnits}, ${l.packSizeLitres}, ${round2(l.qtyUnits * l.packSizeLitres)}, ${l.segment})
        `),
      ]
    : [];

  const stmts = [
    // Backing order first — the invoice's order_id FK and the order_items the
    // allocations reference must exist before those rows insert.
    ...backingOrderStmts,
    sql`
      /* generate_invoice */
      insert into invoices (
        id, invoice_number, invoice_date, customer_id, gst_number,
        invoice_gross_value, total_discount, taxable_value, gst_amount, invoice_net_value,
        total_litres, due_date, credit_days, amount_collected, outstanding_amount,
        payment_status, invoice_source, approval_status, created_by,
        sales_executive_id, party_phone,
        location_id, series_id, supply_type, buyer_state_code,
        cgst_amount, sgst_amount, igst_amount, doc_status,
        place_of_supply, irn, eway_bill_no, order_id,
        transport, vehicle_no, gr_rr_no, station, transport_charge,
        reverse_charge
      ) values (
        ${invoiceId}::uuid, ${invoiceNumber}, ${input.invoiceDate}::date, ${input.customerId}::uuid, ${cust.gstNumber ?? null},
        ${round2(c.taxable + c.totalDiscount)}, ${c.totalDiscount}, ${c.taxable}, ${c.gst}, ${c.grand},
        ${c.totalLitres}, (${input.invoiceDate}::date + ${creditDays}::int), ${creditDays}, 0, ${c.grand},
        'unpaid', 'generated', 'approved', ${userId}::uuid,
        ${seId ? sql`${seId}::uuid` : sql`null`}, ${partyPhone},
        ${input.locationId}::uuid, ${s.id}::uuid, ${supplyType}, ${buyerStateCode},
        ${c.cgst}, ${c.sgst}, ${c.igst}, 'final',
        ${input.placeOfSupply ?? null}, ${input.irn ?? null}, ${input.ewayBillNo ?? null}, ${orderId}::uuid,
        ${input.transport ?? null}, ${input.vehicleNo ?? null}, ${input.grRrNo ?? null}, ${input.station ?? null}, ${c.transportCharge},
        ${input.reverseCharge}
      )
    `,
    ...c.lines.map((l, i) => sql`
      /* generate_invoice_item */
      insert into invoice_items (
        invoice_id, product_id, description, pack_size_litres, brand, segment, hsn_code,
        qty_units, rate, mrp, discount_pct, taxable_amount, gst_rate, cgst, sgst, igst, line_total, cogs_amount, order_item_id
      ) values (
        ${invoiceId}::uuid, ${l.productId}::uuid,
        (select product_name from products where id = ${l.productId}::uuid),
        ${l.packSizeLitres}, ${l.brand}, ${l.segment}, coalesce(${l.hsnCode}, '27101980'),
        ${l.qtyUnits}, ${l.rate}, ${l.mrp}, ${Math.min(100, Math.max(0, l.discountPct || 0))}, ${l.taxable}, ${GST_RATE}, ${l.cgst}, ${l.sgst}, ${l.igst}, ${l.lineTotal}, ${lineCogs(saleAllocs[i])},
        ${lineOrderItemId[i]}::uuid
      )
    `),
    // Deduct stock FEFO across lots: one sale movement + lot decrement per lot
    // touched, plus one aggregate balance decrement per line.
    ...c.lines.flatMap((l, i) => saleAllocs[i].map((al) =>
      movementStmt(sql, { locationId: input.locationId, productId: l.productId, packSizeLitres: l.packSizeLitres, brand: l.brand, qtyUnits: -al.qty, kind: "sale", refType: "invoice", refId: invoiceId, batchId: al.lotId, note: invoiceNumber }, userId),
    )),
    ...c.lines.flatMap((l, i) => saleAllocs[i].map((al) => lotBalanceStmt(sql, al.lotId, -al.qty))),
    ...c.lines.map((l) =>
      balanceStmt(sql, { locationId: input.locationId, productId: l.productId, packSizeLitres: l.packSizeLitres, delta: -l.qtyUnits }),
    ),
    // Link invoiced qty back to the order lines (feeds fulfillment + returns).
    // For a backing order every line maps to a fresh order item; for a real order
    // only the order-linked lines do (ad-hoc lines on a mixed order stay null).
    ...c.lines
      .map((l, i) => ({ l, oiId: lineOrderItemId[i] }))
      .filter((x) => x.oiId)
      .map((x) => sql`
        insert into invoice_line_allocations (invoice_id, order_item_id, quantity_units, litres)
        values (${invoiceId}::uuid, ${x.oiId}::uuid, ${x.l.qtyUnits}, ${round2(x.l.qtyUnits * x.l.packSizeLitres)})
      `),
  ];
  try {
    await sql.transaction(stmts);
  } catch (err) {
    // The number was allocated just above, outside this batch — roll it back so a
    // failed generate leaves no gap in the series (guarded so we only undo our own
    // allocation, never one a concurrent generate took after us).
    await sql`update invoice_series set next_seq = next_seq - 1 where id = ${s.id}::uuid and next_seq = ${seq + 1}`.catch(() => undefined);
    if (/stock_balances_nonneg|stock_lots/.test(String((err as { message?: string })?.message ?? ""))) {
      throw new ApiError("STOCK_SHORT", "Stock ran out while generating. Refresh balances and retry.", 409);
    }
    throw err;
  }
  return { id: invoiceId, invoiceNumber, grandTotal: c.grand, customerName: str(cust.legalName), orderId };
}

export async function generateInvoice(sql: SqlClient, userId: string, input: GenerateInvoiceInput) {
  validateGenerateLines(input.lines);

  const [cust] = await sql`
    /* invoice_customer */
    select legal_name as "legalName", gst_number as "gstNumber", address_state as "addressState",
           credit_days as "creditDays", phone, created_by as "createdBy"
    from customers where id = ${input.customerId}::uuid
  `;
  if (!cust) throw new ApiError("NOT_FOUND", "Customer not found.", 404);

  const buyerStateCode = typeof cust.gstNumber === "string" && cust.gstNumber.length >= 2 ? cust.gstNumber.slice(0, 2) : COMPANY_STATE_CODE;
  const supplyType: "intra" | "inter" = buyerStateCode === COMPANY_STATE_CODE ? "intra" : "inter";
  const c = compute(input.lines, supplyType, input.transportCharge);

  // Attribute the invoice to a sales executive for the mobile notification/feed.
  // party_phone is the customer's phone.
  const seId = await resolveSalesExecutive(sql, input, cust);
  const partyPhone = typeof cust.phone === "string" && cust.phone.trim() ? cust.phone.trim() : null;

  // Hard-block: the godown must hold enough of every line before we deduct.
  const have = await getBalancesForSkus(sql, input.locationId, input.lines);
  const short = input.lines.filter((l) => (have.get(`${l.productId}|${l.packSizeLitres}`) ?? 0) < l.qtyUnits);
  if (short.length > 0) {
    throw new ApiError(
      "STOCK_SHORT",
      `Not enough stock at this godown for ${short.length} line(s). Record a GRN or transfer first.`,
      409,
    );
  }

  // Hard-block: never bill an order line beyond its remaining (ordered − already
  // invoiced). Ad-hoc lines (no order link) are exempt.
  await assertWithinOrderRemaining(sql, input.orderId ?? null, input.lines);

  const fy = finYearOf(input.invoiceDate);
  const creditDays = num(cust.creditDays);
  const prefix = await getInvoiceNumberPrefix(sql);

  const result = await retryOnUniqueViolation(
    () => allocateAndInsertInvoice(sql, { prefix, fy, input, cust, c, creditDays, userId, supplyType, buyerStateCode, seId, partyPhone }),
    // A direct invoice also allocates a backing ORD-#### code, which can race on
    // its own unique index — retry on either collision.
    { constraint: ["invoices_invoice_number_key", "orders_order_code_key"] },
  );

  // Parity with the upload path: notify + push the SE, and recompute the
  // customer's balance so any credit on file is applied and per-invoice
  // outstanding stays in step with the ledger.
  const title = `New invoice ${result.invoiceNumber}`;
  const body = `${str(cust.legalName)} — ₹${c.grand.toLocaleString("en-IN")}`;
  let pushTokens: string[] = [];
  if (seId) {
    await sql`
      /* generate_invoice_notification */
      insert into se_notifications (user_id, type, title, body, invoice_id)
      values (
        ${seId}::uuid, 'invoice', ${title},
        ${`${str(cust.legalName)} — ₹${c.grand.toLocaleString("en-IN")} (${input.invoiceDate}). Tap to view and share.`},
        ${result.id}::uuid
      )
    `;
    const tokens = await sql`
      /* generate_invoice_push_tokens */
      select token from push_tokens where user_id = ${seId}::uuid
    `;
    pushTokens = tokens.map((t) => str(t.token)).filter(Boolean);
  }

  await recomputeCustomerBalances(sql, input.customerId);
  // result.orderId is the real order or the just-created backing order.
  await recomputeOrderFulfillment(sql, result.orderId);

  return { ...result, salesExecutiveId: seId, push: { tokens: pushTokens, title, body } };
}

export interface EditGeneratedInvoiceInput {
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
  lines: GenerateLineInput[];
}

/** Edit a generated invoice IN PLACE (same number + id). Header fields are free;
 *  line changes reverse the old stock and apply the new, rewrite the items +
 *  order allocations, and recompute totals, outstanding, fulfillment and the
 *  customer balance. Blocked once any payment is recorded against it (cancel &
 *  reissue instead). Customer + godown stay fixed. */
/** Load a generated invoice for editing, enforcing the edit preconditions
 *  (generated-source, not cancelled, no payments yet, has a godown). */
async function loadEditableInvoice(sql: SqlClient, invoiceId: string) {
  const [inv] = await sql`
    /* invoice_for_edit */
    select i.invoice_number as "invoiceNumber", i.invoice_source as "invoiceSource", i.doc_status as "docStatus",
           i.location_id as "locationId", i.order_id as "orderId", i.customer_id as "customerId",
           i.supply_type as "supplyType", i.credit_days as "creditDays", i.amount_collected as "amountCollected",
           o.origin as "orderOrigin",
           cu.legal_name as "customerName"
    from invoices i join customers cu on cu.id = i.customer_id
    left join orders o on o.id = i.order_id
    where i.id = ${invoiceId}::uuid
  `;
  if (!inv) throw new ApiError("NOT_FOUND", "Invoice not found.", 404);
  if (str(inv.invoiceSource) !== "generated")
    throw new ApiError("CONFLICT", "Only system-generated invoices can be edited here.", 409);
  if (str(inv.docStatus) === "cancelled")
    throw new ApiError("CONFLICT", "A cancelled invoice can't be edited.", 409);
  if (num(inv.amountCollected) > 0)
    throw new ApiError("CONFLICT", "This invoice has payments recorded against it. Cancel and reissue to change it.", 409);
  if (!inv.locationId)
    throw new ApiError("CONFLICT", "This invoice has no godown to adjust stock against.", 409);
  return inv;
}

/** Net stock pre-check for an edit: current + old − new must stay ≥ 0 per SKU at
 *  this godown (old is reversed, new is applied). Throws STOCK_SHORT otherwise. */
async function assertEditStockAvailable(
  sql: SqlClient,
  locationId: string,
  oldItems: Record<string, unknown>[],
  lines: GenerateLineInput[],
) {
  const keyOf = (p: string, pk: number) => `${p}|${pk}`;
  const oldByKey = new Map<string, number>();
  for (const it of oldItems) {
    const k = keyOf(str(it.productId), num(it.packSizeLitres));
    oldByKey.set(k, (oldByKey.get(k) ?? 0) + num(it.qtyUnits));
  }
  const newByKey = new Map<string, number>();
  for (const l of lines) {
    const k = keyOf(l.productId, l.packSizeLitres);
    newByKey.set(k, (newByKey.get(k) ?? 0) + l.qtyUnits);
  }
  const probe = [...new Set([...oldByKey.keys(), ...newByKey.keys()])].map((k) => {
    const [productId, pk] = k.split("|");
    return { productId, packSizeLitres: Number(pk) };
  });
  const have = await getBalancesForSkus(sql, locationId, probe);
  const shortCount = probe.filter((s) => {
    const k = keyOf(s.productId, s.packSizeLitres);
    return (have.get(k) ?? 0) + (oldByKey.get(k) ?? 0) - (newByKey.get(k) ?? 0) < -0.001;
  }).length;
  if (shortCount > 0)
    throw new ApiError("STOCK_SHORT", `Not enough stock at this godown for ${shortCount} line(s) after the change. Record a GRN or transfer first.`, 409);
}

export async function editGeneratedInvoice(sql: SqlClient, userId: string, invoiceId: string, input: EditGeneratedInvoiceInput) {
  validateGenerateLines(input.lines);

  const inv = await loadEditableInvoice(sql, invoiceId);

  const locationId = str(inv.locationId);
  const orderId = inv.orderId ? str(inv.orderId) : null;
  const customerId = str(inv.customerId);
  const supplyType: "intra" | "inter" = str(inv.supplyType) === "inter" ? "inter" : "intra";
  const creditDays = num(inv.creditDays);
  const c = compute(input.lines, supplyType, input.transportCharge);

  // A backing order (origin='invoice') is owned by its invoice, so the edit keeps
  // the order's lines in step with the edited invoice: its order_items are rebuilt
  // and the invoice lines/allocations re-point to the fresh ids. Blocked once a
  // sales return exists — its sales_return_items reference these order_items, and
  // editing a returned invoice is incoherent anyway (cancel & reissue instead).
  const isBacking = orderId != null && str(inv.orderOrigin) === "invoice";
  if (isBacking) {
    const [ret] = await sql`
      /* edit_invoice_return_guard */
      select 1 as x from sales_returns where invoice_id = ${invoiceId}::uuid limit 1
    `;
    if (ret)
      throw new ApiError("CONFLICT", "This invoice has a sales return against it. Cancel and reissue to change it.", 409);
  }
  // The order-item id each edited line maps to: a fresh id per line for a backing
  // order (rebuilt from scratch), else the caller's own order-item link.
  const editLineOid: (string | null)[] = c.lines.map((l) => (isBacking ? crypto.randomUUID() : l.orderItemId));

  // Old lines (to reverse) + net stock pre-check per SKU:
  //   final = current + old − new  must stay ≥ 0 at this godown.
  const oldItems = await sql`
    /* edit_invoice_old_items */
    select product_id as "productId", pack_size_litres as "packSizeLitres", brand, qty_units as "qtyUnits"
    from invoice_items where invoice_id = ${invoiceId}::uuid
  `;
  await assertEditStockAvailable(sql, locationId, oldItems, input.lines);

  // Over-invoice guard, excluding THIS invoice's own current allocations. Skipped
  // for a backing order — it is defined BY this invoice, so there is no
  // independent ordered quantity to bill against (its lines are rebuilt below).
  if (!isBacking) await assertWithinOrderRemaining(sql, orderId, input.lines, invoiceId);

  // Lot-aware restock: credit back the lots the current sale took, then FEFO-
  // allocate the new lines against (current on-hand + those credits).
  const reversal = await currentSaleLots(sql, invoiceId);
  const newAllocs = await Promise.all(c.lines.map(async (l) => {
    const avail = await listAvailableLots(sql, { locationId, productId: l.productId, packSizeLitres: l.packSizeLitres });
    const byLot = new Map<string, { lotId: string; expiryDate: string | null; qty: number; rate: number | null }>(avail.map((a) => [a.id, { lotId: a.id, expiryDate: a.expiryDate, qty: a.qtyUnits, rate: a.rate }]));
    for (const cr of reversal) {
      if (cr.productId !== l.productId || num(cr.packSizeLitres) !== num(l.packSizeLitres)) continue;
      const cur = byLot.get(cr.batchId);
      if (cur) cur.qty += cr.qty;
      else byLot.set(cr.batchId, { lotId: cr.batchId, expiryDate: cr.expiryDate, qty: cr.qty, rate: cr.rate });
    }
    return fefoSplit([...byLot.values()], l.qtyUnits);
  }));

  const grossValue = round2(c.taxable + c.totalDiscount);
  const stmts = [
    sql`
      /* edit_generated_invoice */
      update invoices set
        invoice_date = ${input.invoiceDate}::date,
        due_date = (${input.invoiceDate}::date + ${creditDays}::int),
        invoice_gross_value = ${grossValue}, total_discount = ${c.totalDiscount},
        taxable_value = ${c.taxable}, gst_amount = ${c.gst}, invoice_net_value = ${c.grand},
        cgst_amount = ${c.cgst}, sgst_amount = ${c.sgst}, igst_amount = ${c.igst},
        total_litres = ${c.totalLitres}, outstanding_amount = ${c.grand}, payment_status = 'unpaid',
        place_of_supply = ${input.placeOfSupply ?? null}, irn = ${input.irn ?? null}, eway_bill_no = ${input.ewayBillNo ?? null},
        reverse_charge = ${input.reverseCharge},
        transport = ${input.transport ?? null}, vehicle_no = ${input.vehicleNo ?? null},
        gr_rr_no = ${input.grRrNo ?? null}, station = ${input.station ?? null}, transport_charge = ${c.transportCharge}, updated_at = now()
      where id = ${invoiceId}::uuid
    `,
    sql`delete from invoice_items where invoice_id = ${invoiceId}::uuid`,
    sql`delete from invoice_line_allocations where invoice_id = ${invoiceId}::uuid`,
    // Rebuild the backing order to match the edited invoice (its items are deleted
    // only after the invoice_items + allocations above release their FKs).
    ...(isBacking
      ? [
          sql`
            /* edit_invoice_backing_order */
            update orders set order_date = ${input.invoiceDate}::date, total_litres = ${c.totalLitres}, updated_at = now()
            where id = ${orderId}::uuid
          `,
          sql`delete from order_items where order_id = ${orderId}::uuid`,
          ...c.lines.map((l, i) => sql`
            /* edit_invoice_backing_order_item */
            insert into order_items (id, order_id, product_id, brand, quantity_units, pack_size_litres, total_litres, segment)
            values (${editLineOid[i]}::uuid, ${orderId}::uuid, ${l.productId}::uuid, ${l.brand}, ${l.qtyUnits}, ${l.packSizeLitres}, ${round2(l.qtyUnits * l.packSizeLitres)}, ${l.segment})
          `),
        ]
      : []),
    ...c.lines.map((l, i) => sql`
      /* edit_invoice_item */
      insert into invoice_items (
        invoice_id, product_id, description, pack_size_litres, brand, segment, hsn_code,
        qty_units, rate, mrp, discount_pct, taxable_amount, gst_rate, cgst, sgst, igst, line_total, cogs_amount, order_item_id
      ) values (
        ${invoiceId}::uuid, ${l.productId}::uuid,
        (select product_name from products where id = ${l.productId}::uuid),
        ${l.packSizeLitres}, ${l.brand}, ${l.segment}, coalesce(${l.hsnCode}, '27101980'),
        ${l.qtyUnits}, ${l.rate}, ${l.mrp}, ${Math.min(100, Math.max(0, l.discountPct || 0))}, ${l.taxable}, ${GST_RATE}, ${l.cgst}, ${l.sgst}, ${l.igst}, ${l.lineTotal}, ${lineCogs(newAllocs[i])},
        ${editLineOid[i]}::uuid
      )
    `),
    ...c.lines
      .map((l, i) => ({ l, oiId: editLineOid[i] }))
      .filter((x) => x.oiId)
      .map((x) => sql`
        insert into invoice_line_allocations (invoice_id, order_item_id, quantity_units, litres)
        values (${invoiceId}::uuid, ${x.oiId}::uuid, ${x.l.qtyUnits}, ${round2(x.l.qtyUnits * x.l.packSizeLitres)})
      `),
    // Reverse the current per-lot sale (credit lots first so none dips below 0),
    // then apply the new per-lot sale (FEFO over on-hand + those credits).
    ...reversal.map((r) => movementStmt(sql, { locationId, productId: r.productId, packSizeLitres: r.packSizeLitres, brand: r.brand, qtyUnits: r.qty, kind: "sale_reversal", refType: "invoice", refId: invoiceId, batchId: r.batchId, note: `Edited ${str(inv.invoiceNumber)}` }, userId)),
    ...reversal.map((r) => lotBalanceStmt(sql, r.batchId, r.qty)),
    ...reversal.map((r) => balanceStmt(sql, { locationId, productId: r.productId, packSizeLitres: r.packSizeLitres, delta: r.qty })),
    ...c.lines.flatMap((l, i) => newAllocs[i].map((al) => movementStmt(sql, { locationId, productId: l.productId, packSizeLitres: l.packSizeLitres, brand: l.brand, qtyUnits: -al.qty, kind: "sale", refType: "invoice", refId: invoiceId, batchId: al.lotId, note: str(inv.invoiceNumber) }, userId))),
    ...c.lines.flatMap((l, i) => newAllocs[i].map((al) => lotBalanceStmt(sql, al.lotId, -al.qty))),
    ...c.lines.map((l) => balanceStmt(sql, { locationId, productId: l.productId, packSizeLitres: l.packSizeLitres, delta: -l.qtyUnits })),
  ];
  try {
    await sql.transaction(stmts);
  } catch (err) {
    if (/stock_balances_nonneg|stock_lots/.test(String((err as { message?: string })?.message ?? "")))
      throw new ApiError("STOCK_SHORT", "Stock ran out while saving. Refresh balances and retry.", 409);
    throw err;
  }

  await recomputeCustomerBalances(sql, customerId);
  if (orderId) await recomputeOrderFulfillment(sql, orderId);

  return { id: invoiceId, invoiceNumber: str(inv.invoiceNumber), grandTotal: c.grand, customerName: str(inv.customerName) };
}

export async function cancelInvoice(sql: SqlClient, userId: string, invoiceId: string, reason: string) {
  if (!reason.trim()) throw new ApiError("INVALID_FIELD", "A cancellation reason is required.", 422);
  const [inv] = await sql`
    /* invoice_for_cancel */
    select i.id, i.invoice_number as "invoiceNumber", i.doc_status as "docStatus",
           i.invoice_source as "invoiceSource", i.location_id as "locationId", i.order_id as "orderId",
           i.customer_id as "customerId", i.amount_collected as "amountCollected",
           o.origin as "orderOrigin"
    from invoices i
    left join orders o on o.id = i.order_id
    where i.id = ${invoiceId}::uuid
  `;
  if (!inv) throw new ApiError("NOT_FOUND", "Invoice not found.", 404);
  if (str(inv.docStatus) === "cancelled") throw new ApiError("CONFLICT", "Invoice is already cancelled.", 409);
  if (str(inv.invoiceSource) !== "generated")
    throw new ApiError("CONFLICT", "Only system-generated invoices can be cancelled here.", 409);
  if (!inv.locationId) throw new ApiError("CONFLICT", "This invoice has no godown to return stock to.", 409);
  // A verified collection is allocated to this invoice; cancelling it now would
  // strand that collection_allocations row against a zeroed/cancelled invoice.
  // Reverse or re-allocate the payment first (mirrors the edit-path guard).
  if (num(inv.amountCollected) > 0)
    throw new ApiError("CONFLICT", "This invoice has payments recorded against it. Reverse or re-allocate the collection before cancelling.", 409);

  const locationId = str(inv.locationId);
  const orderId = inv.orderId ? str(inv.orderId) : null;
  const isBacking = orderId != null && str(inv.orderOrigin) === "invoice";
  // Credit back the exact lots this invoice's sale drew from (net of any edits).
  const reversal = await currentSaleLots(sql, invoiceId);
  const stmts = [
    sql`
      /* cancel_invoice */
      update invoices
      set doc_status = 'cancelled', cancelled_at = now(), cancelled_by = ${userId}::uuid,
          cancel_reason = ${reason.trim()}, outstanding_amount = 0, payment_status = 'unpaid', updated_at = now()
      where id = ${invoiceId}::uuid
    `,
    // A backing order exists only for its invoice — cancel it too so it drops out
    // of the order pipeline and order-based reports with the invoice.
    ...(isBacking
      ? [
          sql`
            /* cancel_invoice_backing_order */
            update orders
            set order_status = 'cancelled', cancellation_note = ${`Invoice ${str(inv.invoiceNumber)} cancelled: ${reason.trim()}`}, updated_at = now()
            where id = ${orderId}::uuid
          `,
        ]
      : []),
    sql`delete from invoice_line_allocations where invoice_id = ${invoiceId}::uuid`,
    ...reversal.map((r) =>
      movementStmt(sql, { locationId, productId: r.productId, packSizeLitres: r.packSizeLitres, brand: r.brand, qtyUnits: r.qty, kind: "sale_reversal", refType: "invoice", refId: invoiceId, batchId: r.batchId, note: `Cancelled ${str(inv.invoiceNumber)}` }, userId),
    ),
    ...reversal.map((r) => lotBalanceStmt(sql, r.batchId, r.qty)),
    ...reversal.map((r) =>
      balanceStmt(sql, { locationId, productId: r.productId, packSizeLitres: r.packSizeLitres, delta: r.qty }),
    ),
  ];
  await sql.transaction(stmts);

  // Re-derive the customer's balance/held-credit from the ledger (parity with
  // generate + edit): cancelling zeroed this invoice's outstanding, so any
  // advance credit or other open invoice must be re-applied.
  await recomputeCustomerBalances(sql, str(inv.customerId));
  if (inv.orderId) await recomputeOrderFulfillment(sql, str(inv.orderId));
  return { id: invoiceId, invoiceNumber: str(inv.invoiceNumber), status: "cancelled" as const };
}

/** Everything needed to render a generated invoice's PDF client-side: the seller
 *  (company profile), the buyer, the lines, and the tax totals. */
export async function getInvoicePdfData(sql: SqlClient, invoiceId: string) {
  const [inv] = await sql`
    /* invoice_pdf_header */
    select i.invoice_number as "invoiceNumber", i.invoice_date as "invoiceDate",
           i.place_of_supply as "placeOfSupply", i.supply_type as "supplyType",
           i.buyer_state_code as "buyerStateCode",
           i.invoice_source as "invoiceSource", i.doc_status as "docStatus",
           i.taxable_value as "taxable", i.total_discount as "totalDiscount",
           i.cgst_amount as "cgst", i.sgst_amount as "sgst",
           i.igst_amount as "igst", i.invoice_net_value as "grand", i.transport_charge as "transportCharge",
           i.total_litres as "totalLitres", i.irn, i.eway_bill_no as "ewayBillNo",
           i.transport, i.vehicle_no as "vehicleNo", i.gr_rr_no as "grRrNo", i.station,
           i.reverse_charge as "reverseCharge",
           se.name as "salesmanName",
           c.legal_name as "customerName", c.gst_number as "customerGstin", c.pan_number as "customerPan",
           c.email as "customerEmail",
           c.address_street as "addressStreet", c.address_city as "addressCity", c.address_landmark as "addressLandmark",
           c.address_state as "addressState", c.address_pincode as "addressPincode", c.phone
    from invoices i
    join customers c on c.id = i.customer_id
    left join users se on se.id = coalesce(i.sales_executive_id, c.created_by)
    where i.id = ${invoiceId}::uuid
  `;
  if (!inv) throw new ApiError("NOT_FOUND", "Invoice not found.", 404);
  if (str(inv.invoiceSource) !== "generated")
    throw new ApiError("CONFLICT", "Only system-generated invoices have a printable PDF here.", 409);

  const items = await getInvoiceItems(sql, invoiceId);
  const settings = await getSystemSettings(sql);

  const nullStr = (v: unknown) => (str(v).trim() === "" ? null : str(v));

  return {
    company: settings.company,
    invoice: {
      invoiceNumber: str(inv.invoiceNumber),
      invoiceDate: str(inv.invoiceDate),
      placeOfSupply: nullStr(inv.placeOfSupply),
      buyerStateCode: nullStr(inv.buyerStateCode),
      supplyType: inv.supplyType == null ? "intra" : str(inv.supplyType),
      docStatus: str(inv.docStatus),
      irn: nullStr(inv.irn),
      ewayBillNo: nullStr(inv.ewayBillNo),
      transport: nullStr(inv.transport),
      vehicleNo: nullStr(inv.vehicleNo),
      grRrNo: nullStr(inv.grRrNo),
      station: nullStr(inv.station),
      salesman: nullStr(inv.salesmanName),
      reverseCharge: Boolean(inv.reverseCharge),
    },
    buyer: {
      name: str(inv.customerName),
      gstin: nullStr(inv.customerGstin),
      pan: nullStr(inv.customerPan),
      email: nullStr(inv.customerEmail),
      phone: nullStr(inv.phone),
      pincode: nullStr(inv.addressPincode),
      address: [inv.addressStreet, inv.addressLandmark, inv.addressCity, inv.addressState].filter(Boolean).map(String).join(", "),
    },
    items,
    totals: {
      taxable: num(inv.taxable), totalDiscount: num(inv.totalDiscount),
      cgst: num(inv.cgst), sgst: num(inv.sgst),
      igst: num(inv.igst), transportCharge: num(inv.transportCharge), grand: num(inv.grand),
      totalLitres: num(inv.totalLitres),
    },
  };
}

/** Structured line items for a generated invoice's detail view. */
export async function getInvoiceItems(sql: SqlClient, invoiceId: string) {
  const rows = await sql`
    /* invoice_items_detail */
    select description, pack_size_litres as "packSizeLitres", brand, segment, hsn_code as "hsnCode",
           qty_units as "qtyUnits", rate, mrp, discount_pct as "discountPct",
           taxable_amount as "taxableAmount", gst_rate as "gstRate",
           cgst, sgst, igst, line_total as "lineTotal"
    from invoice_items where invoice_id = ${invoiceId}::uuid
    order by created_at
  `;
  return rows.map((r) => ({
    description: str(r.description),
    packSizeLitres: num(r.packSizeLitres),
    brand: r.brand == null ? null : str(r.brand),
    segment: r.segment == null ? null : str(r.segment),
    hsnCode: str(r.hsnCode),
    qtyUnits: num(r.qtyUnits),
    rate: num(r.rate),
    mrp: r.mrp == null ? null : num(r.mrp),
    discountPct: num(r.discountPct),
    taxableAmount: num(r.taxableAmount),
    gstRate: num(r.gstRate),
    cgst: num(r.cgst),
    sgst: num(r.sgst),
    igst: num(r.igst),
    lineTotal: num(r.lineTotal),
  }));
}

/** Prefill payload for the edit form: the editable header + the lines in the
 *  form's own shape (productId + orderItemId carried through), plus the locked
 *  customer and godown. Generated, non-cancelled invoices only. */
export async function getGeneratedInvoiceForEdit(sql: SqlClient, invoiceId: string) {
  const [inv] = await sql`
    /* invoice_for_edit_payload */
    select i.invoice_number as "invoiceNumber", i.invoice_date as "invoiceDate", i.invoice_source as "invoiceSource",
           i.doc_status as "docStatus", i.amount_collected as "amountCollected", i.order_id as "orderId",
           i.place_of_supply as "placeOfSupply", i.irn, i.eway_bill_no as "ewayBillNo",
           i.transport, i.vehicle_no as "vehicleNo", i.gr_rr_no as "grRrNo", i.station, i.transport_charge as "transportCharge",
           i.reverse_charge as "reverseCharge",
           i.customer_id as "customerId", cu.legal_name as "customerName",
           i.location_id as "locationId", loc.name as "locationName"
    from invoices i
    join customers cu on cu.id = i.customer_id
    left join stock_locations loc on loc.id = i.location_id
    where i.id = ${invoiceId}::uuid
  `;
  if (!inv) throw new ApiError("NOT_FOUND", "Invoice not found.", 404);
  if (str(inv.invoiceSource) !== "generated")
    throw new ApiError("CONFLICT", "Only system-generated invoices can be edited here.", 409);
  if (str(inv.docStatus) === "cancelled")
    throw new ApiError("CONFLICT", "A cancelled invoice can't be edited.", 409);

  const rows = await sql`
    /* invoice_edit_lines */
    select ii.product_id as "productId", p.product_name as "productName", ii.pack_size_litres as "packSizeLitres",
           ii.brand, ii.segment, ii.hsn_code as "hsnCode", ii.qty_units as "qtyUnits",
           ii.rate, ii.mrp, ii.discount_pct as "discountPct", ii.order_item_id as "orderItemId"
    from invoice_items ii
    left join products p on p.id = ii.product_id
    where ii.invoice_id = ${invoiceId}::uuid
    order by ii.created_at
  `;
  const nullStr = (v: unknown) => (str(v).trim() === "" ? null : str(v));

  return {
    invoiceId,
    invoiceNumber: str(inv.invoiceNumber),
    editable: num(inv.amountCollected) <= 0,
    customer: { id: str(inv.customerId), name: str(inv.customerName) },
    location: { id: str(inv.locationId), name: nullStr(inv.locationName) },
    orderId: nullStr(inv.orderId),
    header: {
      invoiceDate: str(inv.invoiceDate).slice(0, 10),
      placeOfSupply: nullStr(inv.placeOfSupply),
      irn: nullStr(inv.irn),
      ewayBillNo: nullStr(inv.ewayBillNo),
      reverseCharge: Boolean(inv.reverseCharge),
      transport: nullStr(inv.transport),
      vehicleNo: nullStr(inv.vehicleNo),
      grRrNo: nullStr(inv.grRrNo),
      station: nullStr(inv.station),
      transportCharge: num(inv.transportCharge),
    },
    lines: rows.map((r) => ({
      productId: str(r.productId),
      productName: str(r.productName),
      packSizeLitres: num(r.packSizeLitres),
      brand: r.brand == null ? null : str(r.brand),
      segment: r.segment == null ? null : str(r.segment),
      hsnCode: nullStr(r.hsnCode),
      qty: num(r.qtyUnits),
      rate: num(r.rate),
      mrp: r.mrp == null ? null : num(r.mrp),
      discountPct: num(r.discountPct),
      orderItemId: nullStr(r.orderItemId),
    })),
  };
}

/** Render a generated invoice's PDF on demand from its data — the single source
 *  of truth (no stored copy). Authorizes office roles always; a SALES_EXECUTIVE
 *  only for an invoice that is theirs. Runs the shared jsPDF renderer on Workers. */
export async function getInvoicePdfBytes(
  sql: SqlClient,
  context: { userId: string; role: string | null },
  invoiceId: string,
): Promise<{ bytes: ArrayBuffer; fileName: string }> {
  const [row] = (await sql`
    /* invoice_pdf_auth */
    select invoice_number as "invoiceNumber", sales_executive_id as "seId"
    from invoices
    where id = ${invoiceId}::uuid
    limit 1
  `) as Record<string, unknown>[];
  if (!row) throw new ApiError("NOT_FOUND", "Invoice not found.", 404);
  if (context.role === "SALES_EXECUTIVE" && str(row.seId) !== context.userId) {
    throw new ApiError("NOT_FOUND", "Invoice not found.", 404);
  }
  const data = (await getInvoicePdfData(sql, invoiceId)) as unknown as PdfData;
  const doc = await buildInvoiceDoc(data);
  const bytes = doc.output("arraybuffer") as ArrayBuffer;
  return { bytes, fileName: `${str(row.invoiceNumber).replace(/[^\w-]+/g, "_")}.pdf` };
}
