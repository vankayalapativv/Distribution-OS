import type { R2Bucket } from "@cloudflare/workers-types";
import { R2_STORAGE_CLASS } from "../lib/r2";
import type { SqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";
import { recomputeCustomerBalances } from "./reconcile-recompute";
import { recomputeFulfillmentForInvoice } from "./fulfillment";
import { allocateReturnAdjustment, allocateReturnRestock, type ReturnRestock } from "./stock";
import { balanceStmt, lotBalanceStmt, movementStmt } from "./stock-shared";

type Row = Record<string, unknown>;

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
}
function nullStr(v: unknown): string | null {
  const s = str(v);
  return s.length > 0 ? s : null;
}
function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function isoDate(v: unknown): string {
  return str(v).slice(0, 10);
}

const EPS = 0.005;

/** One invoice line the user could return (already-returned qty subtracted). */
export interface ReturnableLine {
  orderItemId: string;
  kind: "oil";
  segment: string | null;
  description: string;
  /**
   * GST-INCLUSIVE rupees per unit (line `amount` ÷ billed qty). The invoice
   * `amount` already carries GST, so this is what's removed from outstanding —
   * no gross-up is applied on top.
   */
  unitPrice: number;
  /** Pre-GST rupees per unit (line `price`) — used only for the SE/SKU metrics. */
  unitTaxable: number;
  /** Litres per unit for oils. */
  packLitresPerUnit: number | null;
  billedUnits: number;
  returnedUnits: number;
  returnableUnits: number;
}

/** A billed jsonb line (price/description source), consumed once as matched. */
interface BilledLine {
  kind: "oil";
  quantity: number;
  litres: number;
  amount: number;
  price: number;
  description: string;
  used: boolean;
}

/** Aggregated billed totals for one order SKU on the invoice. */
interface Agg {
  kind: "oil";
  segment: string | null;
  label: string;
  description: string;
  billedUnits: number;
  litres: number;
  /** GST-inclusive billed total (Σ line.amount). */
  grossAmount: number;
  /** Pre-GST billed total (Σ qty × line.price). */
  taxableAmount: number;
}

/**
 * Match each allocation to a billed jsonb line (matching qty + litres, else
 * qty-only, else the next unused line — each consumed once) and aggregate the
 * billed totals per order SKU.
 */
function aggregateBilledByItem(allocRows: Row[], jsonLines: BilledLine[]): Map<string, Agg> {
  const byItem = new Map<string, Agg>();
  for (const a of allocRows) {
    const orderItemId = str(a.orderItemId);
    const qty = num(a.quantityUnits);
    const lit = num(a.litres);
    let match =
      jsonLines.find(
        (l) => !l.used && Math.abs(l.quantity - qty) < 0.01 && Math.abs(l.litres - lit) < 0.01,
      ) ?? jsonLines.find((l) => !l.used && Math.abs(l.quantity - qty) < 0.01);
    match ??= jsonLines.find((l) => !l.used);
    if (match) match.used = true;

    const cur = byItem.get(orderItemId) ?? {
      kind: "oil" as const,
      segment: nullStr(a.segment),
      label: str(a.label),
      description: "",
      billedUnits: 0,
      litres: 0,
      grossAmount: 0,
      taxableAmount: 0,
    };
    cur.billedUnits += qty;
    cur.litres += lit;
    cur.grossAmount += match ? match.amount : 0;
    cur.taxableAmount += match ? match.quantity * match.price : 0;
    if (match && !cur.description) cur.description = match.description;
    byItem.set(orderItemId, cur);
  }
  return byItem;
}

/** Aggregated billed totals + already-returned tallies → the picker's returnable
 *  lines (only those with something still left to return). */
function toReturnableLines(
  byItem: Map<string, Agg>,
  returnedByItem: Map<string, number>,
): ReturnableLine[] {
  const lines: ReturnableLine[] = [];
  for (const [orderItemId, l] of byItem) {
    const returnedUnits = returnedByItem.get(orderItemId) ?? 0;
    const returnableUnits = round2(l.billedUnits - returnedUnits);
    if (returnableUnits <= EPS) continue;
    lines.push({
      orderItemId,
      kind: l.kind,
      segment: l.segment,
      description: l.description || l.label,
      // GST-inclusive per unit (removed from outstanding as-is; no gross-up).
      unitPrice: l.billedUnits > 0 ? round2(l.grossAmount / l.billedUnits) : 0,
      // Pre-GST per unit (metrics only).
      unitTaxable: l.billedUnits > 0 ? round2(l.taxableAmount / l.billedUnits) : 0,
      packLitresPerUnit: l.billedUnits > 0 ? round2(l.litres / l.billedUnits) : null,
      billedUnits: round2(l.billedUnits),
      returnedUnits: round2(returnedUnits),
      returnableUnits,
    });
  }
  return lines;
}

/** The invoice + its returnable lines, for the Sales Return picker.
 *  `excludeReturnId` omits one existing return from the already-returned tally —
 *  used when editing that return so its own quantities read as available again. */
export async function getReturnableInvoice(
  sql: SqlClient,
  invoiceId: string,
  excludeReturnId: string | null = null,
) {
  const [inv] = (await sql`
    /* return_invoice_header */
    select
      i.id,
      i.invoice_number as "invoiceNumber",
      i.invoice_date as "invoiceDate",
      i.customer_id as "customerId",
      c.legal_name as "customerName",
      i.outstanding_amount as "outstandingAmount",
      i.taxable_value as "taxableValue",
      i.invoice_net_value as "grandTotal",
      i.approval_status as "approvalStatus",
      i.line_items as "lineItems"
    from invoices i
    join customers c on c.id = i.customer_id
    where i.id = ${invoiceId}::uuid and i.doc_status <> 'cancelled'
    limit 1
  `) as Row[];
  if (!inv) throw new ApiError("NOT_FOUND", "Invoice not found.", 404);

  // The authoritative invoice → order-SKU mapping is invoice_line_allocations
  // (written on generate/upload). Neither the line_items jsonb (uploaded) nor the
  // allocation rows carry a price, so we drive off allocations and recover each
  // line's price + description from the billed lines (line_items jsonb for
  // uploaded invoices, invoice_items for generated ones) by matching qty (+ litres).
  const allocRows = (await sql`
    /* return_allocations */
    select
      a.order_item_id as "orderItemId",
      a.quantity_units as "quantityUnits",
      a.litres as "litres",
      oi.segment as "segment",
      coalesce(p.product_name, '') as "label"
    from invoice_line_allocations a
    join order_items oi on oi.id = a.order_item_id
    left join products p on p.id = oi.product_id
    where a.invoice_id = ${invoiceId}::uuid
  `) as Row[];

  // Billed jsonb lines (price/description source), consumed as matched.
  // `amount` is the GST-INCLUSIVE line total; `price` is the pre-GST unit rate.
  let jsonLines: BilledLine[] = (Array.isArray(inv.lineItems) ? (inv.lineItems as Record<string, unknown>[]) : [])
    .filter((li) => str(li.kind) === "oil")
    .map((li) => ({
      kind: "oil" as const,
      quantity: num(li.quantity),
      litres: num(li.litres),
      amount: num(li.amount),
      price: num(li.price),
      description: str(li.description),
      used: false,
    }));

  // Generated invoices carry NO line_items jsonb — their structured prices live
  // in invoice_items (rate = pre-GST unit, line_total = GST-inclusive). Build the
  // billed-line price source from there so a return recovers the real rate, not ₹0.
  if (jsonLines.length === 0) {
    const itemRows = (await sql`
      /* return_invoice_items */
      select qty_units as "quantity", pack_size_litres as "pack",
             rate as "price", line_total as "amount", description
      from invoice_items where invoice_id = ${invoiceId}::uuid
    `) as Row[];
    jsonLines = itemRows.map((r) => ({
      kind: "oil" as const,
      quantity: num(r.quantity),
      litres: round2(num(r.quantity) * num(r.pack)),
      amount: num(r.amount),
      price: num(r.price),
      description: str(r.description),
      used: false,
    }));
  }

  const byItem = aggregateBilledByItem(allocRows, jsonLines);

  // Units already returned against this invoice, per SKU.
  const returnedByItem = new Map<string, number>();
  const retRows = (await sql`
    /* return_already_returned */
    select sri.order_item_id as "orderItemId", coalesce(sum(sri.quantity_units), 0) as "units"
    from sales_return_items sri
    join sales_returns sr on sr.id = sri.sales_return_id
    where sr.invoice_id = ${invoiceId}::uuid
      and (${excludeReturnId}::uuid is null or sr.id <> ${excludeReturnId}::uuid)
    group by sri.order_item_id
  `) as Row[];
  for (const r of retRows) returnedByItem.set(str(r.orderItemId), num(r.units));

  const lines = toReturnableLines(byItem, returnedByItem);

  return {
    invoice: {
      id: str(inv.id),
      invoiceNumber: str(inv.invoiceNumber),
      invoiceDate: isoDate(inv.invoiceDate),
      customerId: str(inv.customerId),
      customerName: str(inv.customerName),
      outstandingAmount: round2(num(inv.outstandingAmount)),
    },
    lines,
  };
}

export interface SalesReturnItemInput {
  orderItemId: string;
  quantityUnits: number;
}
export interface CreateSalesReturnInput {
  invoiceId: string;
  returnDate: string | null;
  reason: string | null;
  items: SalesReturnItemInput[];
}

interface Built {
  orderItemId: string;
  kind: "oil";
  segment: string | null;
  description: string;
  unitPrice: number;
  quantityUnits: number;
  litres: number | null;
  taxableAmount: number;
  grossAmount: number;
}

/**
 * Validate requested return quantities against an invoice's returnable lines +
 * available outstanding, and build the priced return items. No side effects, so
 * callers validate BEFORE mutating. `excludeReturnId` drops an existing return
 * from the already-returned tally (editing it); `extraOutstanding` adds that
 * return's gross back to the outstanding cap (its effect is being reversed).
 */
async function buildReturnLines(
  sql: SqlClient,
  invoiceId: string,
  customerId: string,
  items: SalesReturnItemInput[],
  opts: { excludeReturnId?: string | null; extraOutstanding?: number } = {},
): Promise<{ built: Built[]; totalTaxable: number; totalGross: number; invoiceNumber: string }> {
  if (items.length === 0) {
    throw new ApiError("INVALID_FIELD", "Select at least one line to return.", 422);
  }
  const { invoice, lines } = await getReturnableInvoice(sql, invoiceId, opts.excludeReturnId ?? null);
  if (invoice.customerId !== customerId) {
    throw new ApiError("NOT_FOUND", "Invoice not found for this customer.", 404);
  }
  const availableOutstanding = round2(invoice.outstandingAmount + (opts.extraOutstanding ?? 0));
  if (availableOutstanding <= EPS) {
    throw new ApiError(
      "CONFLICT",
      "This invoice is fully paid — a return can only be raised on an invoice with an outstanding balance.",
      409,
    );
  }
  const lineByItem = new Map(lines.map((l) => [l.orderItemId, l]));

  const built: Built[] = [];
  let totalTaxable = 0;
  let totalGross = 0;
  for (const item of items) {
    const qty = num(item.quantityUnits);
    if (qty <= EPS) continue;
    const line = lineByItem.get(item.orderItemId);
    if (!line) {
      throw new ApiError(
        "INVALID_FIELD",
        "A selected line isn't billed on this invoice, or is already fully returned.",
        422,
      );
    }
    if (qty > line.returnableUnits + EPS) {
      throw new ApiError(
        "INVALID_FIELD",
        `"${line.description}": only ${line.returnableUnits} left to return, ${qty} requested.`,
        422,
      );
    }
    const gross = round2(line.unitPrice * qty);
    const taxable = round2(line.unitTaxable * qty);
    totalTaxable = round2(totalTaxable + taxable);
    totalGross = round2(totalGross + gross);
    built.push({
      orderItemId: line.orderItemId,
      kind: line.kind,
      segment: line.segment,
      description: line.description,
      unitPrice: line.unitPrice,
      quantityUnits: qty,
      litres: line.packLitresPerUnit != null ? round2(line.packLitresPerUnit * qty) : null,
      taxableAmount: taxable,
      grossAmount: gross,
    });
  }
  if (built.length === 0 || totalGross <= EPS) {
    throw new ApiError("INVALID_FIELD", "Nothing to return — enter a quantity.", 422);
  }
  if (totalGross > availableOutstanding + EPS) {
    throw new ApiError(
      "INVALID_FIELD",
      `Return of ₹${totalGross.toLocaleString("en-IN")} exceeds the invoice's outstanding ₹${availableOutstanding.toLocaleString("en-IN")}. Reduce the quantity.`,
      422,
    );
  }
  return { built, totalTaxable, totalGross, invoiceNumber: invoice.invoiceNumber };
}

/** Serialize built return items for the `sales_return_items` bulk insert. */
function returnItemsJson(built: Built[]): string {
  return JSON.stringify(
    built.map((b) => ({
      orderItemId: b.orderItemId,
      kind: b.kind,
      segment: b.segment,
      description: b.description,
      unitPrice: b.unitPrice,
      quantityUnits: b.quantityUnits,
      litres: b.litres,
      taxableAmount: b.taxableAmount,
      grossAmount: b.grossAmount,
    })),
  );
}

/**
 * Record a sales return against one invoice. Immediate effect: posts the
 * ledger credit (via the sales_returns row), lowers the invoice outstanding,
 * and — because items carry order_item_id — lets the metric reversal net out
 * SE oil totals and the SKU-analytics dashboard in the original period.
 */
export async function createSalesReturn(
  sql: SqlClient,
  bucket: R2Bucket | null,
  context: { userId: string },
  customerId: string,
  input: CreateSalesReturnInput,
  file: File | null,
) {
  const { built, totalTaxable, totalGross, invoiceNumber } = await buildReturnLines(
    sql,
    input.invoiceId,
    customerId,
    input.items,
  );

  const returnId = crypto.randomUUID();

  // Store the proof (optional) before the transaction — R2 puts can't be inside
  // sql.transaction. Content type is read back from R2 on download.
  let proofUrl: string | null = null;
  if (file && bucket) {
    proofUrl = `returns/${returnId}/${crypto.randomUUID()}`;
    await bucket.put(proofUrl, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
      storageClass: R2_STORAGE_CLASS,
    });
  }

  const itemsJson = returnItemsJson(built);

  // Restock the returned units back to the lots the sale is still holding — ONLY
  // for system-generated invoices (uploaded invoices never deducted our stock, so
  // there is nothing to put back). Reverse-FEFO, same batch + godown; posted in
  // the SAME transaction as the financial effect so money and stock never diverge.
  const [invStock] = (await sql`
    /* return_invoice_stock_meta */
    select location_id as "locationId", invoice_source as "invoiceSource"
    from invoices where id = ${input.invoiceId}::uuid
  `) as Row[];
  const locationId = invStock ? str(invStock.locationId) : "";
  let restock: ReturnRestock[] = [];
  if (invStock && str(invStock.invoiceSource) === "generated") {
    const metaRows = (await sql`
      /* return_invoice_item_meta */
      select order_item_id as "orderItemId", product_id as "productId", pack_size_litres as "packSizeLitres"
      from invoice_items where invoice_id = ${input.invoiceId}::uuid
    `) as Row[];
    const metaByItem = new Map(
      metaRows.map((m) => [str(m.orderItemId), { productId: str(m.productId), packSizeLitres: num(m.packSizeLitres) }]),
    );
    const restockLines = built.flatMap((b) => {
      const m = metaByItem.get(b.orderItemId);
      return m ? [{ productId: m.productId, packSizeLitres: m.packSizeLitres, qtyUnits: b.quantityUnits }] : [];
    });
    restock = await allocateReturnRestock(sql, input.invoiceId, restockLines);
  }

  await sql.transaction([
    sql`
      /* create_sales_return */
      insert into sales_returns (
        id, invoice_id, customer_id, return_date, reason, proof_url,
        taxable_amount, gross_amount, created_by
      ) values (
        ${returnId}::uuid,
        ${input.invoiceId}::uuid,
        ${customerId}::uuid,
        coalesce(${input.returnDate}::date, (now() at time zone 'Asia/Kolkata')::date),
        ${input.reason},
        ${proofUrl},
        ${totalTaxable},
        ${totalGross},
        ${context.userId}::uuid
      )
    `,
    sql`
      /* create_sales_return_items */
      insert into sales_return_items (
        sales_return_id, order_item_id, kind, segment, description,
        unit_price, quantity_units, litres, taxable_amount, gross_amount
      )
      select
        ${returnId}::uuid,
        (v->>'orderItemId')::uuid,
        v->>'kind',
        v->>'segment',
        coalesce(v->>'description', ''),
        (v->>'unitPrice')::numeric,
        (v->>'quantityUnits')::numeric,
        nullif(v->>'litres', '')::numeric,
        (v->>'taxableAmount')::numeric,
        (v->>'grossAmount')::numeric
      from jsonb_array_elements(${itemsJson}::jsonb) v
    `,
    sql`
      /* return_reduce_invoice_outstanding */
      update invoices
      set outstanding_amount = greatest(0, outstanding_amount - ${totalGross}),
          payment_status = case
            when outstanding_amount - ${totalGross} <= ${EPS} then 'paid'
            when amount_collected > 0 then 'partially_paid'
            else 'unpaid'
          end,
          updated_at = now()
      where id = ${input.invoiceId}::uuid
    `,
    // Restock: a `return` movement (+qty) per lot, plus lot + balance increments.
    ...restock.map((r) =>
      movementStmt(
        sql,
        { locationId, productId: r.productId, packSizeLitres: r.packSizeLitres, brand: r.brand, qtyUnits: r.qty, kind: "return", refType: "invoice", refId: input.invoiceId, batchId: r.batchId, note: `Return ${invoiceNumber}` },
        context.userId,
      ),
    ),
    ...restock.map((r) => lotBalanceStmt(sql, r.batchId, r.qty)),
    ...restock.map((r) => balanceStmt(sql, { locationId, productId: r.productId, packSizeLitres: r.packSizeLitres, delta: r.qty })),
  ]);

  await recomputeCustomerBalances(sql, customerId);
  // A return moves the order to partially_returned / returned.
  await recomputeFulfillmentForInvoice(sql, input.invoiceId);
  return {
    id: returnId,
    invoiceId: input.invoiceId,
    invoiceNumber,
    taxableAmount: totalTaxable,
    grossAmount: totalGross,
    itemCount: built.length,
  };
}

/**
 * Edit an existing sales return — full re-entry of the returned line quantities
 * (SUPER_ADMIN ledger correction). Reverses the return's current effect and
 * re-applies the new quantities in ONE transaction, so the invoice outstanding
 * nets to (old gross − new gross) and never lands in a half-reversed state.
 * Validation (returnable limits + outstanding cap) runs BEFORE any mutation.
 */
export async function updateSalesReturn(
  sql: SqlClient,
  bucket: R2Bucket | null,
  context: { userId: string },
  returnId: string,
  input: { returnDate: string | null; reason: string | null; items: SalesReturnItemInput[] },
  file: File | null,
) {
  const [existing] = (await sql`
    /* get_sales_return_for_update */
    select id, invoice_id as "invoiceId", customer_id as "customerId",
      gross_amount as "grossAmount", proof_url as "proofUrl"
    from sales_returns where id = ${returnId}::uuid
  `) as Row[];
  if (!existing) throw new ApiError("NOT_FOUND", "Sales return not found.", 404);

  const invoiceId = str(existing.invoiceId);
  const customerId = str(existing.customerId);
  const oldGross = num(existing.grossAmount);

  // Validate the new quantities against returnable-excluding-this-return, with
  // this return's gross added back to the outstanding cap. No mutation yet.
  const { built, totalTaxable, totalGross, invoiceNumber } = await buildReturnLines(
    sql,
    invoiceId,
    customerId,
    input.items,
    { excludeReturnId: returnId, extraOutstanding: oldGross },
  );

  // Optional proof replacement (R2 put before the transaction).
  let proofUrl = nullStr(existing.proofUrl);
  if (file && bucket) {
    const newUrl = `returns/${returnId}/${crypto.randomUUID()}`;
    await bucket.put(newUrl, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
      storageClass: R2_STORAGE_CLASS,
    });
    const oldUrl = proofUrl;
    proofUrl = newUrl;
    if (oldUrl) await bucket.delete(oldUrl).catch(() => undefined);
  }

  const itemsJson = returnItemsJson(built);
  const netDelta = round2(oldGross - totalGross); // + restores, − reduces outstanding

  // Stock delta: an edit changes the restocked quantity, so apply only the CHANGE
  // per SKU (new − old units) to the lots — add more to the sale's still-out lots
  // (positive delta) or pull units back out of the invoice's returned lots
  // (negative delta). Generated invoices only (uploaded invoices never moved our
  // stock). Posted in the same transaction as the financial edit.
  const [invMeta] = (await sql`
    /* return_edit_invoice_stock_meta */
    select location_id as "locationId", invoice_source as "invoiceSource"
    from invoices where id = ${invoiceId}::uuid
  `) as Row[];
  const locationId = invMeta ? str(invMeta.locationId) : "";
  let adjust: ReturnRestock[] = [];
  if (invMeta && str(invMeta.invoiceSource) === "generated") {
    const oldItems = (await sql`
      /* return_edit_old_items */
      select order_item_id as "orderItemId", quantity_units as "quantityUnits"
      from sales_return_items where sales_return_id = ${returnId}::uuid
    `) as Row[];
    const metaRows = (await sql`
      /* return_edit_item_meta */
      select order_item_id as "orderItemId", product_id as "productId", pack_size_litres as "packSizeLitres"
      from invoice_items where invoice_id = ${invoiceId}::uuid
    `) as Row[];
    const metaByItem = new Map(metaRows.map((m) => [str(m.orderItemId), { productId: str(m.productId), packSizeLitres: num(m.packSizeLitres) }]));
    const deltaBySku = new Map<string, { productId: string; packSizeLitres: number; delta: number }>();
    const bump = (orderItemId: string, qty: number) => {
      const meta = metaByItem.get(orderItemId);
      if (!meta) return;
      const k = `${meta.productId}|${meta.packSizeLitres}`;
      const cur = deltaBySku.get(k) ?? { productId: meta.productId, packSizeLitres: meta.packSizeLitres, delta: 0 };
      cur.delta = round2(cur.delta + qty);
      deltaBySku.set(k, cur);
    };
    for (const o of oldItems) bump(str(o.orderItemId), -num(o.quantityUnits));
    for (const b of built) bump(b.orderItemId, b.quantityUnits);
    adjust = await allocateReturnAdjustment(sql, invoiceId, [...deltaBySku.values()]);
  }

  await sql.transaction([
    sql`/* update_sales_return_clear_items */ delete from sales_return_items where sales_return_id = ${returnId}::uuid`,
    sql`
      /* update_sales_return */
      update sales_returns set
        return_date    = coalesce(${input.returnDate}::date, return_date),
        reason         = ${input.reason},
        proof_url      = ${proofUrl},
        taxable_amount = ${totalTaxable},
        gross_amount   = ${totalGross}
      where id = ${returnId}::uuid
    `,
    sql`
      /* update_sales_return_items */
      insert into sales_return_items (
        sales_return_id, order_item_id, kind, segment, description,
        unit_price, quantity_units, litres, taxable_amount, gross_amount
      )
      select
        ${returnId}::uuid,
        (v->>'orderItemId')::uuid,
        v->>'kind',
        v->>'segment',
        coalesce(v->>'description', ''),
        (v->>'unitPrice')::numeric,
        (v->>'quantityUnits')::numeric,
        nullif(v->>'litres', '')::numeric,
        (v->>'taxableAmount')::numeric,
        (v->>'grossAmount')::numeric
      from jsonb_array_elements(${itemsJson}::jsonb) v
    `,
    sql`
      /* return_edit_adjust_invoice_outstanding */
      update invoices
      set outstanding_amount = greatest(0, outstanding_amount + ${netDelta}),
          payment_status = case
            when outstanding_amount + ${netDelta} <= ${EPS} then 'paid'
            when amount_collected > 0 then 'partially_paid'
            else 'unpaid'
          end,
          updated_at = now()
      where id = ${invoiceId}::uuid
    `,
    // Stock delta: signed `return` movements (+ add back / − pull out) + lot/balance.
    ...adjust.map((r) =>
      movementStmt(
        sql,
        { locationId, productId: r.productId, packSizeLitres: r.packSizeLitres, brand: r.brand, qtyUnits: r.qty, kind: "return", refType: "invoice", refId: invoiceId, batchId: r.batchId, note: `Return edit ${invoiceNumber}` },
        context.userId,
      ),
    ),
    ...adjust.map((r) => lotBalanceStmt(sql, r.batchId, r.qty)),
    ...adjust.map((r) => balanceStmt(sql, { locationId, productId: r.productId, packSizeLitres: r.packSizeLitres, delta: r.qty })),
  ]);

  await recomputeCustomerBalances(sql, customerId);
  // Edited quantities can flip returned ⇄ partially_returned (or back to delivered).
  await recomputeFulfillmentForInvoice(sql, invoiceId);
  return {
    id: returnId,
    invoiceId,
    invoiceNumber,
    taxableAmount: totalTaxable,
    grossAmount: totalGross,
    itemCount: built.length,
  };
}

/**
 * Load a return for editing: its header, the invoice's currently-returnable
 * lines (with THIS return's units freed back up), and this return's current
 * per-line quantities to pre-fill the form.
 */
export async function getSalesReturnForEdit(sql: SqlClient, returnId: string) {
  const [row] = (await sql`
    /* get_sales_return_header */
    select id, invoice_id as "invoiceId", return_date as "returnDate", reason,
      gross_amount as "grossAmount"
    from sales_returns where id = ${returnId}::uuid
  `) as Row[];
  if (!row) throw new ApiError("NOT_FOUND", "Sales return not found.", 404);

  const invoiceId = str(row.invoiceId);
  const { invoice, lines } = await getReturnableInvoice(sql, invoiceId, returnId);

  const itemRows = (await sql`
    /* get_sales_return_items */
    select order_item_id as "orderItemId", quantity_units as "quantityUnits"
    from sales_return_items where sales_return_id = ${returnId}::uuid
  `) as Row[];

  return {
    id: returnId,
    invoiceId,
    invoiceNumber: invoice.invoiceNumber,
    returnDate: isoDate(row.returnDate),
    reason: nullStr(row.reason),
    // Cap the edited return can use = invoice's current outstanding + this
    // return's own gross (whose reduction is being reversed).
    availableOutstanding: round2(invoice.outstandingAmount + num(row.grossAmount)),
    lines,
    currentItems: itemRows.map((r) => ({
      orderItemId: str(r.orderItemId),
      quantityUnits: num(r.quantityUnits),
    })),
  };
}

/** Stream a return's proof file (image/PDF) back. Office reviewers only. */
export async function getSalesReturnProof(sql: SqlClient, bucket: R2Bucket, returnId: string) {
  const [row] = (await sql`
    /* get_sales_return_proof */
    select proof_url as "proofUrl" from sales_returns where id = ${returnId}::uuid limit 1
  `) as Row[];
  if (!row || !nullStr(row.proofUrl)) {
    throw new ApiError("NOT_FOUND", "No proof on this return.", 404);
  }
  const object = await bucket.get(str(row.proofUrl));
  if (!object) throw new ApiError("NOT_FOUND", "Proof file not found.", 404);
  return {
    body: object.body as unknown as ReadableStream,
    contentType: object.httpMetadata?.contentType ?? "application/octet-stream",
  };
}
