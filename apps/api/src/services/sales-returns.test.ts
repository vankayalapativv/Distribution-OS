import { afterEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  recomputeCustomerBalances: vi.fn().mockResolvedValue(undefined),
  recomputeFulfillmentForInvoice: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./reconcile-recompute", () => ({ recomputeCustomerBalances: h.recomputeCustomerBalances }));
vi.mock("./fulfillment", () => ({ recomputeFulfillmentForInvoice: h.recomputeFulfillmentForInvoice }));

import {
  createSalesReturn,
  getReturnableInvoice,
  getSalesReturnForEdit,
  getSalesReturnProof,
  updateSalesReturn,
} from "./sales-returns";
import { makeSql } from "../test/sql-mock";

const CUST = "cust-1";
const INV = "inv-1";

/** A billed invoice with one returnable oil line (2 units, ₹236 incl. GST). */
const RET = (over: Record<string, unknown> = {}) => ({
  return_invoice_header: [
    {
      id: INV, invoiceNumber: "INV-1", invoiceDate: "2026-06-01", customerId: CUST, customerName: "Ravi",
      outstandingAmount: "236", taxableValue: "200", grandTotal: "236", approvalStatus: "approved",
      lineItems: [{ kind: "oil", quantity: 2, litres: 10, amount: 236, price: 100, description: "Titan 5L" }],
    },
  ],
  return_allocations: [{ orderItemId: "oi-1", quantityUnits: "2", litres: "10", segment: "Car", label: "Titan" }],
  return_already_returned: [],
  ...over,
});

const fakeFile = () => ({ type: "image/jpeg", arrayBuffer: async () => new ArrayBuffer(4) }) as unknown as File;
const fakeBucket = () => ({ put: vi.fn().mockResolvedValue(undefined), get: vi.fn(), delete: vi.fn().mockResolvedValue(undefined) });

afterEach(() => vi.clearAllMocks());

describe("getReturnableInvoice", () => {
  it("builds the returnable line (GST-incl unit price, net of already-returned)", async () => {
    const { invoice, lines } = await getReturnableInvoice(makeSql(RET()), INV);
    expect(invoice).toMatchObject({ invoiceNumber: "INV-1", outstandingAmount: 236 });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ orderItemId: "oi-1", unitPrice: 118, unitTaxable: 100, returnableUnits: 2, packLitresPerUnit: 5 });
  });

  it("recovers prices from invoice_items when there is no line_items jsonb (generated invoices)", async () => {
    const sql = makeSql(
      RET({
        return_invoice_header: [{ id: INV, invoiceNumber: "INV-1", invoiceDate: "2026-06-01", customerId: CUST, customerName: "Ravi", outstandingAmount: "236", taxableValue: "200", grandTotal: "236", approvalStatus: "approved", lineItems: [] }],
        return_invoice_items: [{ quantity: "2", pack: "5", price: "100", amount: "236", description: "Titan" }],
      }),
    );
    const { lines } = await getReturnableInvoice(sql, INV);
    expect(lines[0]).toMatchObject({ unitPrice: 118, unitTaxable: 100 });
  });

  it("drops a line once it has been fully returned", async () => {
    const sql = makeSql(RET({ return_already_returned: [{ orderItemId: "oi-1", units: "2" }] }));
    const { lines } = await getReturnableInvoice(sql, INV);
    expect(lines).toEqual([]);
  });

  it("matches qty-only and leaves unmatched allocations priced at 0", async () => {
    const sql = makeSql(
      RET({
        return_allocations: [
          { orderItemId: "oi-1", quantityUnits: "2", litres: "10", segment: "Car", label: "Titan" },
          { orderItemId: "oi-2", quantityUnits: "1", litres: "5", segment: "2W", label: "Other" },
        ],
        // one line matches oi-1 on qty only (litres differ); nothing for oi-2
        return_invoice_header: [{ id: INV, invoiceNumber: "INV-1", invoiceDate: "2026-06-01", customerId: CUST, customerName: "Ravi", outstandingAmount: "500", taxableValue: "400", grandTotal: "500", approvalStatus: "approved", lineItems: [{ kind: "oil", quantity: 2, litres: 999, amount: 236, price: 100, description: "Titan" }] }],
        // a null units row exercises num()'s non-numeric fallback (→ 0)
        return_already_returned: [{ orderItemId: "oi-9", units: null }],
      }),
    );
    const { lines } = await getReturnableInvoice(sql, INV);
    const oi2 = lines.find((l) => l.orderItemId === "oi-2")!;
    expect(oi2.unitPrice).toBe(0); // no billed line matched
    const oi1 = lines.find((l) => l.orderItemId === "oi-1")!;
    expect(oi1.unitPrice).toBe(118); // matched on qty despite litres mismatch
  });

  it("404s when the invoice does not exist", async () => {
    await expect(getReturnableInvoice(makeSql({ return_invoice_header: [] }), INV)).rejects.toMatchObject({ status: 404 });
  });
});

describe("createSalesReturn", () => {
  it("validates, posts the return, lowers outstanding, and recomputes", async () => {
    const sql = makeSql(RET());
    const res = await createSalesReturn(sql, null, { userId: "u1" }, CUST, { invoiceId: INV, returnDate: null, reason: "damaged", items: [{ orderItemId: "oi-1", quantityUnits: 1 }] }, null);
    expect(res).toMatchObject({ invoiceNumber: "INV-1", grossAmount: 118, taxableAmount: 100, itemCount: 1 });
    expect(h.recomputeCustomerBalances).toHaveBeenCalledWith(sql, CUST);
    expect(h.recomputeFulfillmentForInvoice).toHaveBeenCalledWith(sql, INV);
  });

  it("stores the proof file in R2 when provided", async () => {
    const bucket = fakeBucket();
    await createSalesReturn(makeSql(RET()), bucket as never, { userId: "u1" }, CUST, { invoiceId: INV, returnDate: "2026-06-02", reason: null, items: [{ orderItemId: "oi-1", quantityUnits: 1 }] }, fakeFile());
    expect(bucket.put).toHaveBeenCalledOnce();
  });

  it("rejects an empty selection (422)", async () => {
    await expect(createSalesReturn(makeSql(RET()), null, { userId: "u1" }, CUST, { invoiceId: INV, returnDate: null, reason: null, items: [] }, null)).rejects.toMatchObject({ status: 422 });
  });

  it("404s on a customer mismatch", async () => {
    await expect(createSalesReturn(makeSql(RET()), null, { userId: "u1" }, "other-cust", { invoiceId: INV, returnDate: null, reason: null, items: [{ orderItemId: "oi-1", quantityUnits: 1 }] }, null)).rejects.toMatchObject({ status: 404 });
  });

  it("409s when the invoice is fully paid (no outstanding)", async () => {
    const sql = makeSql(RET({ return_invoice_header: [{ id: INV, invoiceNumber: "INV-1", invoiceDate: "2026-06-01", customerId: CUST, customerName: "Ravi", outstandingAmount: "0", taxableValue: "200", grandTotal: "236", approvalStatus: "approved", lineItems: [{ kind: "oil", quantity: 2, litres: 10, amount: 236, price: 100, description: "Titan" }] }] }));
    await expect(createSalesReturn(sql, null, { userId: "u1" }, CUST, { invoiceId: INV, returnDate: null, reason: null, items: [{ orderItemId: "oi-1", quantityUnits: 1 }] }, null)).rejects.toMatchObject({ status: 409 });
  });

  it("422s a line that isn't billed on the invoice", async () => {
    await expect(createSalesReturn(makeSql(RET()), null, { userId: "u1" }, CUST, { invoiceId: INV, returnDate: null, reason: null, items: [{ orderItemId: "ghost", quantityUnits: 1 }] }, null)).rejects.toMatchObject({ status: 422 });
  });

  it("422s when the quantity exceeds what's returnable", async () => {
    await expect(createSalesReturn(makeSql(RET()), null, { userId: "u1" }, CUST, { invoiceId: INV, returnDate: null, reason: null, items: [{ orderItemId: "oi-1", quantityUnits: 5 }] }, null)).rejects.toMatchObject({ status: 422 });
  });

  it("422s when every requested quantity is zero (nothing to return)", async () => {
    await expect(createSalesReturn(makeSql(RET()), null, { userId: "u1" }, CUST, { invoiceId: INV, returnDate: null, reason: null, items: [{ orderItemId: "oi-1", quantityUnits: 0 }] }, null)).rejects.toMatchObject({ status: 422 });
  });

  it("422s when the return value exceeds outstanding", async () => {
    // outstanding only ₹50, but 1 unit returns ₹118
    const sql = makeSql(RET({ return_invoice_header: [{ id: INV, invoiceNumber: "INV-1", invoiceDate: "2026-06-01", customerId: CUST, customerName: "Ravi", outstandingAmount: "50", taxableValue: "200", grandTotal: "236", approvalStatus: "approved", lineItems: [{ kind: "oil", quantity: 2, litres: 10, amount: 236, price: 100, description: "Titan" }] }] }));
    await expect(createSalesReturn(sql, null, { userId: "u1" }, CUST, { invoiceId: INV, returnDate: null, reason: null, items: [{ orderItemId: "oi-1", quantityUnits: 1 }] }, null)).rejects.toMatchObject({ status: 422 });
  });

  it("restocks the returned units to the sale's lot on a generated invoice", async () => {
    const sql = makeSql(
      RET({
        return_invoice_header: [{ id: INV, invoiceNumber: "INV-1", invoiceDate: "2026-06-01", customerId: CUST, customerName: "Ravi", outstandingAmount: "236", taxableValue: "200", grandTotal: "236", approvalStatus: "approved", lineItems: [] }],
        return_invoice_items: [{ quantity: "2", pack: "5", price: "100", amount: "236", description: "Titan 5L" }],
        return_invoice_stock_meta: [{ locationId: "loc-1", invoiceSource: "generated" }],
        return_invoice_item_meta: [{ orderItemId: "oi-1", productId: "p1", packSizeLitres: "5" }],
        invoice_sale_lots: [{ productId: "p1", packSizeLitres: "5", brand: "Fuchs", batchId: "lot-a", expiryDate: null, qty: "2" }],
      }),
    );
    const res = await createSalesReturn(sql, null, { userId: "u1" }, CUST, { invoiceId: INV, returnDate: null, reason: null, items: [{ orderItemId: "oi-1", quantityUnits: 1 }] }, null);
    expect(res).toMatchObject({ invoiceId: INV, grossAmount: 118 });
    // The return posted a restock: a `return` movement + lot + balance increments.
    expect(sql.calls.some((c) => c.tag === "stock_movement")).toBe(true);
    expect(sql.calls.some((c) => c.tag === "stock_lot_balance")).toBe(true);
    expect(sql.calls.some((c) => c.tag === "stock_balance_upsert")).toBe(true);
  });

  it("skips restock when the invoice line has no stock metadata (uploaded / no lots)", async () => {
    const sql = makeSql(
      RET({
        return_invoice_header: [{ id: INV, invoiceNumber: "INV-1", invoiceDate: "2026-06-01", customerId: CUST, customerName: "Ravi", outstandingAmount: "236", taxableValue: "200", grandTotal: "236", approvalStatus: "approved", lineItems: [] }],
        return_invoice_items: [{ quantity: "2", pack: "5", price: "100", amount: "236", description: "Titan 5L" }],
        return_invoice_stock_meta: [{ locationId: "loc-1", invoiceSource: "generated" }],
        return_invoice_item_meta: [], // no mapping for oi-1 → nothing to restock
      }),
    );
    await createSalesReturn(sql, null, { userId: "u1" }, CUST, { invoiceId: INV, returnDate: null, reason: null, items: [{ orderItemId: "oi-1", quantityUnits: 1 }] }, null);
    expect(sql.calls.some((c) => c.tag === "stock_movement")).toBe(false);
  });
});

describe("updateSalesReturn", () => {
  const existing = { get_sales_return_for_update: [{ id: "r1", invoiceId: INV, customerId: CUST, grossAmount: "118", proofUrl: "returns/r1/old" }] };

  it("re-enters the quantities and nets the invoice outstanding", async () => {
    const sql = makeSql({ ...RET(), ...existing });
    const res = await updateSalesReturn(sql, null, { userId: "u1" }, "r1", { returnDate: null, reason: "fixed", items: [{ orderItemId: "oi-1", quantityUnits: 2 }] }, null);
    expect(res).toMatchObject({ id: "r1", grossAmount: 236, itemCount: 1 });
    expect(h.recomputeFulfillmentForInvoice).toHaveBeenCalledWith(sql, INV);
  });

  it("replaces the proof file (puts new, deletes old)", async () => {
    const bucket = fakeBucket();
    await updateSalesReturn(makeSql({ ...RET(), ...existing }), bucket as never, { userId: "u1" }, "r1", { returnDate: null, reason: null, items: [{ orderItemId: "oi-1", quantityUnits: 1 }] }, fakeFile());
    expect(bucket.put).toHaveBeenCalledOnce();
    expect(bucket.delete).toHaveBeenCalledWith("returns/r1/old");
  });

  it("adjusts stock by the delta on a generated invoice (edit up restocks the difference)", async () => {
    const sql = makeSql({
      ...RET({
        return_invoice_header: [{ id: INV, invoiceNumber: "INV-1", invoiceDate: "2026-06-01", customerId: CUST, customerName: "Ravi", outstandingAmount: "236", taxableValue: "200", grandTotal: "236", approvalStatus: "approved", lineItems: [] }],
        return_invoice_items: [{ quantity: "2", pack: "5", price: "100", amount: "236", description: "Titan 5L" }],
      }),
      ...existing,
      return_edit_invoice_stock_meta: [{ locationId: "loc-1", invoiceSource: "generated" }],
      return_edit_old_items: [{ orderItemId: "oi-1", quantityUnits: "1" }], // was 1 returned
      return_edit_item_meta: [{ orderItemId: "oi-1", productId: "p1", packSizeLitres: "5" }],
      invoice_sale_lots: [{ productId: "p1", packSizeLitres: "5", brand: "Fuchs", batchId: "lot-a", expiryDate: null, qty: "2" }],
    });
    // Edit the return up to 2 → delta +1 → restock one more unit.
    await updateSalesReturn(sql, null, { userId: "u1" }, "r1", { returnDate: null, reason: null, items: [{ orderItemId: "oi-1", quantityUnits: 2 }] }, null);
    expect(sql.calls.some((c) => c.tag === "stock_movement")).toBe(true);
    expect(sql.calls.some((c) => c.tag === "stock_lot_balance")).toBe(true);
  });

  it("404s when the return does not exist", async () => {
    await expect(updateSalesReturn(makeSql({ get_sales_return_for_update: [] }), null, { userId: "u1" }, "x", { returnDate: null, reason: null, items: [{ orderItemId: "oi-1", quantityUnits: 1 }] }, null)).rejects.toMatchObject({ status: 404 });
  });
});

describe("getSalesReturnForEdit", () => {
  it("returns the header, returnable lines, and current quantities", async () => {
    const sql = makeSql({
      ...RET(),
      get_sales_return_header: [{ id: "r1", invoiceId: INV, returnDate: "2026-06-02", reason: "damaged", grossAmount: "118" }],
      get_sales_return_items: [{ orderItemId: "oi-1", quantityUnits: "1" }],
    });
    const out = await getSalesReturnForEdit(sql, "r1");
    expect(out).toMatchObject({ invoiceNumber: "INV-1", reason: "damaged" });
    expect(out.availableOutstanding).toBe(354); // 236 outstanding + 118 own gross
    expect(out.currentItems).toEqual([{ orderItemId: "oi-1", quantityUnits: 1 }]);
  });

  it("404s when the return is missing", async () => {
    await expect(getSalesReturnForEdit(makeSql({ get_sales_return_header: [] }), "x")).rejects.toMatchObject({ status: 404 });
  });
});

describe("getSalesReturnProof", () => {
  it("streams the stored proof", async () => {
    const bucket = { get: vi.fn().mockResolvedValue({ body: "STREAM", httpMetadata: { contentType: "image/png" } }) };
    const sql = makeSql({ get_sales_return_proof: [{ proofUrl: "returns/r1/x" }] });
    const out = await getSalesReturnProof(sql, bucket as never, "r1");
    expect(out).toMatchObject({ contentType: "image/png" });
  });

  it("404s when there is no proof url, or the object is gone", async () => {
    await expect(getSalesReturnProof(makeSql({ get_sales_return_proof: [{ proofUrl: null }] }), { get: vi.fn() } as never, "r1")).rejects.toMatchObject({ status: 404 });
    const bucket = { get: vi.fn().mockResolvedValue(null) };
    await expect(getSalesReturnProof(makeSql({ get_sales_return_proof: [{ proofUrl: "returns/r1/x" }] }), bucket as never, "r1")).rejects.toMatchObject({ status: 404 });
  });
});
