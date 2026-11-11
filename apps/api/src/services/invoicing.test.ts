import { afterEach, describe, expect, it, vi } from "vitest";

const { getBalancesForSkus } = vi.hoisted(() => ({ getBalancesForSkus: vi.fn() }));
const { allocateSaleFefo } = vi.hoisted(() => ({ allocateSaleFefo: vi.fn().mockResolvedValue([{ lotId: "lot-1", qty: 2, rate: 90 }]) }));
const { currentSaleLots } = vi.hoisted(() => ({ currentSaleLots: vi.fn().mockResolvedValue([
  { productId: "p1", packSizeLitres: 1, brand: "Fuchs", batchId: "lot-1", expiryDate: null, qty: 2 }, // matches the edit line + is on-hand (merge)
  { productId: "p1", packSizeLitres: 1, brand: "Fuchs", batchId: "lot-2", expiryDate: "2027-01-01", qty: 1 }, // matches but NOT on-hand (else-create)
  { productId: "p9", packSizeLitres: 9, brand: null, batchId: "lot-3", expiryDate: null, qty: 1 }, // different SKU (skip)
]) }));
const { listAvailableLots } = vi.hoisted(() => ({ listAvailableLots: vi.fn().mockResolvedValue([{ id: "lot-1", expiryDate: null, qtyUnits: 100 }]) }));
const { fefoSplit } = vi.hoisted(() => ({ fefoSplit: vi.fn().mockReturnValue([{ lotId: "lot-1", qty: 2 }]) }));
const { recomputeCustomerBalances } = vi.hoisted(() => ({ recomputeCustomerBalances: vi.fn().mockResolvedValue(undefined) }));
const { recomputeOrderFulfillment } = vi.hoisted(() => ({ recomputeOrderFulfillment: vi.fn().mockResolvedValue(undefined) }));
const { getSystemSettings } = vi.hoisted(() => ({ getSystemSettings: vi.fn().mockResolvedValue({ company: { name: "Distribution OS", gstin: "36XXX" } }) }));
const { buildInvoiceDoc } = vi.hoisted(() => ({ buildInvoiceDoc: vi.fn().mockResolvedValue({ output: () => new ArrayBuffer(8) }) }));

vi.mock("./stock", () => ({ getBalancesForSkus, allocateSaleFefo, currentSaleLots, listAvailableLots, fefoSplit }));
vi.mock("./reconcile-recompute", () => ({ recomputeCustomerBalances }));
vi.mock("./fulfillment", () => ({ recomputeOrderFulfillment }));
vi.mock("./system-settings", () => ({ getSystemSettings }));
vi.mock("@distribution-os/shared", () => ({ buildInvoiceDoc }));

import {
  cancelInvoice,
  editGeneratedInvoice,
  generateInvoice,
  getGeneratedInvoiceForEdit,
  getInvoiceItems,
  getInvoiceNumberConfig,
  getInvoiceNumberPrefix,
  getInvoicePdfBytes,
  getInvoicePdfData,
  getNextInvoiceNumberPreview,
  setInvoiceNumberConfig,
} from "./invoicing";
import { makeSql, calledTag } from "../test/sql-mock";

const CUST = "cust-1";
const line = (over = {}) => ({
  productId: "p1",
  packSizeLitres: 1,
  brand: "Fuchs",
  segment: "Car",
  hsnCode: "27101980",
  qtyUnits: 2,
  rate: 100,
  mrp: null,
  discountPct: 0,
  orderItemId: null,
  ...over,
});
const enoughStock = () => new Map([["p1|1", 100]]);

afterEach(() => vi.clearAllMocks());

describe("invoice-number config", () => {
  it("reads the prefix (default SA/ when unset)", async () => {
    expect(await getInvoiceNumberPrefix(makeSql({ "": [{ value: "ABC/" }] }))).toBe("ABC/");
    expect(await getInvoiceNumberPrefix(makeSql({ "": [] }))).toBe("SA/");
  });

  it("returns the next-number config (seeding defaults when no series row)", async () => {
    const cfg = await getInvoiceNumberConfig(makeSql({ "": [{ value: "SA/" }], invoice_series_current: [] }));
    expect(cfg).toMatchObject({ prefix: "SA/", nextNumber: 1, padWidth: 5 });
  });

  it("formats the next-number preview", async () => {
    const sql = makeSql({ "": [{ value: "SA/" }], invoice_series_current: [{ nextSeq: "7", padWidth: "5" }] });
    const prev = await getNextInvoiceNumberPreview(sql);
    expect(prev.invoiceNumber).toMatch(/^SA\/\d{4}-\d{2}\/00007$/);
  });

  it("writes the prefix + next number", async () => {
    const sql = makeSql({ "": [] });
    await setInvoiceNumberConfig(sql, { prefix: "", nextNumber: 10 }); // blank → default SA/
    expect(sql.calls.filter((c) => c.tag === "")).toHaveLength(2);
  });
});

describe("generateInvoice", () => {
  const custRow = { legalName: "Ravi Motors", gstNumber: "36ABCDE1234F1Z5", addressState: "Telangana", creditDays: "30", phone: "9999999999", createdBy: "u-se" };
  const base = () => ({
    customerId: CUST,
    locationId: "loc-1",
    invoiceDate: "2026-06-01",
    orderId: null,
    placeOfSupply: null,
    irn: null,
    ewayBillNo: null,
    reverseCharge: false,
    transport: null,
    vehicleNo: null,
    grRrNo: null,
    station: null,
    transportCharge: 0,
    lines: [line()],
  });

  const happySql = () =>
    makeSql({
      "": ({ text }) => {
        if (text.includes("from system_settings")) return [{ value: "SA/" }];
        return []; // invoice_series insert, etc.
      },
      invoice_customer: [custRow],
      invoice_se_from_customer: [{ id: "se-1" }],
      allocate_invoice_number: [{ id: "s1", seq: "1", padWidth: "5" }],
      generate_invoice: [],
      generate_invoice_item: [],
      generate_invoice_notification: [],
      generate_invoice_push_tokens: [{ token: "tokA" }],
    });

  it("computes 18% intra-state GST, allocates a number, and attributes the SE", async () => {
    getBalancesForSkus.mockResolvedValue(enoughStock());
    const sql = happySql();
    const res = await generateInvoice(sql, "admin-1", base());
    expect(res.invoiceNumber).toBe("SA/2026-27/00001");
    expect(res.grandTotal).toBe(236); // 200 taxable + 36 GST
    expect(res.salesExecutiveId).toBe("se-1");
    expect(res.push.tokens).toEqual(["tokA"]);
    expect(recomputeCustomerBalances).toHaveBeenCalledWith(sql, CUST);
    // A direct invoice now auto-creates a backing order (origin='invoice') so it
    // always has order_id + allocations; fulfillment is recomputed on that order.
    expect(calledTag(sql, "generate_invoice_backing_order")).toBe(true);
    expect(recomputeOrderFulfillment).toHaveBeenCalledTimes(1);
    // COGS recorded from the FEFO-drawn lot's rate: 2 units × ₹90.
    expect(sql.calls.find((c) => c.tag === "generate_invoice_item")?.params).toContain(180);
  });

  it("backs a direct invoice with an ORD order: invoice-date, resolved SE, one line per invoice line, and an allocation", async () => {
    getBalancesForSkus.mockResolvedValue(enoughStock());
    const sql = happySql();
    await generateInvoice(sql, "admin-1", base());
    // Backing order header: invoice date (param) + origin='invoice' (literal).
    // (SE attribution is asserted via res.salesExecutiveId in the test above.)
    const order = sql.calls.find((c) => c.tag === "generate_invoice_backing_order");
    expect(order).toBeTruthy();
    expect(order?.params).toContain("2026-06-01");
    expect(order?.text).toContain("'invoice'");
    // One backing order line per invoice line, and an allocation back to it, so a
    // directly-generated invoice is now returnable / order-reportable.
    expect(sql.calls.filter((c) => c.tag === "generate_invoice_backing_order_item")).toHaveLength(1);
    expect(sql.calls.some((c) => c.text.includes("invoice_line_allocations"))).toBe(true);
  });

  it("maps each line to its own order item + allocation on a multi-line backing order (no cross-wiring)", async () => {
    getBalancesForSkus.mockResolvedValue(new Map([["p1|1", 100], ["p2|5", 100]]));
    const sql = happySql();
    await generateInvoice(sql, "admin-1", {
      ...base(),
      lines: [line(), line({ productId: "p2", packSizeLitres: 5, qtyUnits: 3 })],
    });
    // One backing order item per line, each with a distinct id keyed by product.
    const items = sql.calls.filter((c) => c.tag === "generate_invoice_backing_order_item");
    expect(items).toHaveLength(2);
    const oidByProduct = new Map(items.map((c) => [c.params[2], c.params[0]])); // product -> order_item id
    expect(oidByProduct.get("p1")).not.toBe(oidByProduct.get("p2"));
    // Each allocation must reference ITS line's order item: qty 2 -> p1's item,
    // qty 3 -> p2's item (guards the per-line index correspondence).
    const allocs = sql.calls.filter((c) => c.text.includes("invoice_line_allocations"));
    expect(allocs).toHaveLength(2);
    const oidByQty = new Map(allocs.map((c) => [String(c.params[2]), c.params[1]])); // qty -> order_item id
    expect(oidByQty.get("2")).toBe(oidByProduct.get("p1"));
    expect(oidByQty.get("3")).toBe(oidByProduct.get("p2"));
  });

  it("adds the transport charge straight to the grand total (no GST on it)", async () => {
    getBalancesForSkus.mockResolvedValue(enoughStock());
    const res = await generateInvoice(happySql(), "admin-1", { ...base(), transportCharge: 150 });
    expect(res.grandTotal).toBe(386); // 200 taxable + 36 GST + 150 transport
  });

  it("validates the lines (empty / zero qty / negative rate → 422)", async () => {
    getBalancesForSkus.mockResolvedValue(enoughStock());
    await expect(generateInvoice(makeSql(), "u", { ...base(), lines: [] })).rejects.toMatchObject({ status: 422 });
    await expect(generateInvoice(makeSql(), "u", { ...base(), lines: [line({ qtyUnits: 0 })] })).rejects.toMatchObject({ status: 422 });
    await expect(generateInvoice(makeSql(), "u", { ...base(), lines: [line({ rate: -1 })] })).rejects.toMatchObject({ status: 422 });
  });

  it("404s when the customer is missing", async () => {
    const sql = makeSql({ invoice_customer: [] });
    await expect(generateInvoice(sql, "u", base())).rejects.toMatchObject({ status: 404 });
  });

  it("hard-blocks when the godown is short (STOCK_SHORT 409)", async () => {
    getBalancesForSkus.mockResolvedValue(new Map([["p1|1", 0]]));
    const sql = makeSql({ "": [{ value: "SA/" }], invoice_customer: [custRow], invoice_se_from_customer: [{ id: "se-1" }] });
    await expect(generateInvoice(sql, "u", base())).rejects.toMatchObject({ code: "STOCK_SHORT", status: 409 });
  });

  it("maps the non-negative balance CHECK violation to STOCK_SHORT and rolls the number back", async () => {
    getBalancesForSkus.mockResolvedValue(enoughStock());
    const sql = happySql();
    (sql as unknown as { transaction: () => Promise<unknown> }).transaction = () => {
      throw new Error('new row violates check constraint "stock_balances_nonneg"');
    };
    await expect(generateInvoice(sql, "u", base())).rejects.toMatchObject({ code: "STOCK_SHORT", status: 409 });
  });

  it("rejects an order-linked line with no order (422) and over-invoiced lines (INVOICE_MISMATCH)", async () => {
    getBalancesForSkus.mockResolvedValue(enoughStock());
    // Linked line but orderId null.
    await expect(
      generateInvoice(makeSql({ "": [{ value: "SA/" }], invoice_customer: [custRow] }), "u", {
        ...base(),
        lines: [line({ orderItemId: "oi-1" })],
      }),
    ).rejects.toMatchObject({ status: 422 });

    // Over-invoice: order remaining 1, requesting 2.
    const sql = makeSql({
      "": ({ text }) => (text.includes("from system_settings") ? [{ value: "SA/" }] : []),
      invoice_customer: [custRow],
      invoice_se_from_customer: [{ id: "se-1" }],
      generate_order_skus_remaining: [{ id: "oi-1", label: "Titan", orderedUnits: "1", allocatedUnits: "0" }],
    });
    await expect(
      generateInvoice(sql, "u", { ...base(), orderId: "o-1", lines: [line({ orderItemId: "oi-1", qtyUnits: 2 })] }),
    ).rejects.toMatchObject({ code: "INVOICE_MISMATCH", status: 422 });
  });

  it("rejects a line linked to an item that is not on the order (INVOICE_MISMATCH)", async () => {
    getBalancesForSkus.mockResolvedValue(enoughStock());
    const sql = makeSql({
      "": ({ text }) => (text.includes("from system_settings") ? [{ value: "SA/" }] : []),
      invoice_customer: [custRow],
      invoice_se_from_customer: [{ id: "se-1" }],
      generate_order_skus_remaining: [{ id: "oi-OTHER", label: "X", orderedUnits: "5", allocatedUnits: "0" }],
    });
    await expect(
      generateInvoice(sql, "u", { ...base(), orderId: "o-1", lines: [line({ orderItemId: "oi-1" })] }),
    ).rejects.toMatchObject({ code: "INVOICE_MISMATCH", status: 422 });
  });

  it("writes order allocations for an order-linked line and recomputes fulfillment", async () => {
    getBalancesForSkus.mockResolvedValue(enoughStock());
    const sql = makeSql({
      "": ({ text }) => {
        if (text.includes("from system_settings")) return [{ value: "SA/" }];
        if (text.includes("from orders")) return [{ seId: "se-1" }];
        return [];
      },
      invoice_customer: [custRow],
      generate_order_skus_remaining: [{ id: "oi-1", label: "Titan", orderedUnits: "5", allocatedUnits: "0" }],
      allocate_invoice_number: [{ id: "s1", seq: "1", padWidth: "5" }],
      generate_invoice: [],
      generate_invoice_item: [],
      generate_invoice_notification: [],
      generate_invoice_push_tokens: [],
    });
    const res = await generateInvoice(sql, "u", { ...base(), orderId: "o-1", lines: [line({ orderItemId: "oi-1", qtyUnits: 2 })] });
    expect(res.invoiceNumber).toBe("SA/2026-27/00001");
    expect(recomputeOrderFulfillment).toHaveBeenCalledWith(sql, "o-1");
  });

  it("rethrows a non-stock transaction error (and rolls the number back)", async () => {
    getBalancesForSkus.mockResolvedValue(enoughStock());
    const sql = happySql();
    (sql as unknown as { transaction: () => Promise<unknown> }).transaction = () => {
      throw new Error("db boom");
    };
    await expect(generateInvoice(sql, "u", base())).rejects.toThrow("db boom");
  });
});

describe("editGeneratedInvoice", () => {
  const editable = {
    invoiceNumber: "SA/2026-27/00001",
    invoiceSource: "generated",
    docStatus: "final",
    locationId: "loc-1",
    orderId: null,
    customerId: CUST,
    supplyType: "intra",
    creditDays: "30",
    amountCollected: "0",
    customerName: "Ravi Motors",
  };
  const editInput = {
    invoiceDate: "2026-06-02",
    placeOfSupply: null,
    irn: null,
    ewayBillNo: null,
    reverseCharge: false,
    transport: null,
    vehicleNo: null,
    grRrNo: null,
    station: null,
    transportCharge: 0,
    lines: [line({ qtyUnits: 3 })],
  };

  it("rewrites the invoice, recomputes, and returns the new total", async () => {
    getBalancesForSkus.mockResolvedValue(enoughStock());
    const sql = makeSql({
      invoice_for_edit: [editable],
      edit_invoice_old_items: [{ productId: "p1", packSizeLitres: 1, brand: null, qtyUnits: "1" }],
      edit_generated_invoice: [],
      edit_invoice_item: [],
    });
    const res = await editGeneratedInvoice(sql, "u", "inv-1", editInput);
    expect(res).toMatchObject({ id: "inv-1", invoiceNumber: "SA/2026-27/00001", grandTotal: 354 }); // 3×100 +18%
    expect(recomputeCustomerBalances).toHaveBeenCalled();
  });

  it("keeps a backing order (origin='invoice') in step: rebuilds its items", async () => {
    getBalancesForSkus.mockResolvedValue(enoughStock());
    const sql = makeSql({
      invoice_for_edit: [{ ...editable, orderId: "o-1", orderOrigin: "invoice" }],
      edit_invoice_old_items: [{ productId: "p1", packSizeLitres: 1, brand: null, qtyUnits: "1" }],
      edit_generated_invoice: [],
      edit_invoice_item: [],
      edit_invoice_return_guard: [], // no sales return against this invoice
    });
    const res = await editGeneratedInvoice(sql, "u", "inv-1", editInput);
    expect(res.grandTotal).toBe(354);
    expect(calledTag(sql, "edit_invoice_backing_order")).toBe(true);
    expect(sql.calls.filter((c) => c.tag === "edit_invoice_backing_order_item")).toHaveLength(1);
    expect(recomputeOrderFulfillment).toHaveBeenCalledWith(sql, "o-1");
  });

  it("blocks editing a backing-order invoice that already has a sales return (409)", async () => {
    getBalancesForSkus.mockResolvedValue(enoughStock());
    const sql = makeSql({
      invoice_for_edit: [{ ...editable, orderId: "o-1", orderOrigin: "invoice" }],
      edit_invoice_return_guard: [{ x: 1 }], // a sales return exists → cancel & reissue instead
    });
    await expect(editGeneratedInvoice(sql, "u", "inv-1", editInput)).rejects.toMatchObject({ status: 409 });
    expect(calledTag(sql, "edit_invoice_backing_order")).toBe(false);
  });

  it("enforces the edit preconditions", async () => {
    await expect(editGeneratedInvoice(makeSql({ invoice_for_edit: [] }), "u", "x", editInput)).rejects.toMatchObject({ status: 404 });
    await expect(
      editGeneratedInvoice(makeSql({ invoice_for_edit: [{ ...editable, invoiceSource: "uploaded" }] }), "u", "x", editInput),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      editGeneratedInvoice(makeSql({ invoice_for_edit: [{ ...editable, docStatus: "cancelled" }] }), "u", "x", editInput),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      editGeneratedInvoice(makeSql({ invoice_for_edit: [{ ...editable, amountCollected: "500" }] }), "u", "x", editInput),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      editGeneratedInvoice(makeSql({ invoice_for_edit: [{ ...editable, locationId: null }] }), "u", "x", editInput),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("blocks an edit that would oversell the godown (STOCK_SHORT pre-check)", async () => {
    getBalancesForSkus.mockResolvedValue(new Map([["p1|1", 0]])); // have 0, old 1, new 3 → -2
    const sql = makeSql({
      invoice_for_edit: [editable],
      edit_invoice_old_items: [{ productId: "p1", packSizeLitres: 1, brand: null, qtyUnits: "1" }],
    });
    await expect(editGeneratedInvoice(sql, "u", "inv-1", editInput)).rejects.toMatchObject({ code: "STOCK_SHORT" });
  });

  it("maps a transaction CHECK violation to STOCK_SHORT, and rethrows other errors", async () => {
    getBalancesForSkus.mockResolvedValue(enoughStock());
    const mk = () =>
      makeSql({
        invoice_for_edit: [editable],
        edit_invoice_old_items: [{ productId: "p1", packSizeLitres: 1, brand: "Fuchs", qtyUnits: "1" }],
      });
    const shortSql = mk();
    (shortSql as unknown as { transaction: () => Promise<unknown> }).transaction = () => {
      throw new Error('violates check constraint "stock_balances_nonneg"');
    };
    await expect(editGeneratedInvoice(shortSql, "u", "inv-1", editInput)).rejects.toMatchObject({ code: "STOCK_SHORT" });

    const boomSql = mk();
    (boomSql as unknown as { transaction: () => Promise<unknown> }).transaction = () => {
      throw new Error("db boom");
    };
    await expect(editGeneratedInvoice(boomSql, "u", "inv-1", editInput)).rejects.toThrow("db boom");
  });
});

describe("cancelInvoice", () => {
  const cancellable = { id: "inv-1", invoiceNumber: "SA/2026-27/00001", docStatus: "final", invoiceSource: "generated", locationId: "loc-1", orderId: "o-1", customerId: "cust-1", amountCollected: "0" };

  it("requires a reason (422)", async () => {
    await expect(cancelInvoice(makeSql(), "u", "inv-1", "  ")).rejects.toMatchObject({ status: 422 });
  });

  it("reverses stock, re-opens the order, recomputes the customer balance, and marks cancelled", async () => {
    const sql = makeSql({
      invoice_for_cancel: [cancellable],
      cancel_invoice: [],
      // the untagged `select ... from invoice_items` → the stock to return
      "": [{ productId: "p1", packSizeLitres: 1, brand: "Fuchs", qtyUnits: "2" }],
    });
    const res = await cancelInvoice(sql, "u", "inv-1", "duplicate");
    expect(res).toMatchObject({ id: "inv-1", status: "cancelled" });
    expect(recomputeOrderFulfillment).toHaveBeenCalledWith(sql, "o-1");
    expect(recomputeCustomerBalances).toHaveBeenCalledWith(sql, "cust-1"); // ledger re-derived
    expect(calledTag(sql, "stock_movement")).toBe(true); // item reversals ran
    // A real order (origin defaults to standard) is NOT cancelled with the invoice.
    expect(calledTag(sql, "cancel_invoice_backing_order")).toBe(false);
  });

  it("blocks cancelling an invoice that already has a payment recorded (409)", async () => {
    const sql = makeSql({ invoice_for_cancel: [{ ...cancellable, amountCollected: "500" }] });
    await expect(cancelInvoice(sql, "u", "inv-1", "duplicate")).rejects.toMatchObject({ status: 409 });
    expect(calledTag(sql, "cancel_invoice")).toBe(false); // nothing mutated
  });

  it("cancels the backing order alongside an origin='invoice' invoice", async () => {
    const sql = makeSql({
      invoice_for_cancel: [{ ...cancellable, orderOrigin: "invoice" }],
      cancel_invoice: [],
      "": [{ productId: "p1", packSizeLitres: 1, brand: "Fuchs", qtyUnits: "2" }],
    });
    const res = await cancelInvoice(sql, "u", "inv-1", "duplicate");
    expect(res.status).toBe("cancelled");
    expect(calledTag(sql, "cancel_invoice_backing_order")).toBe(true);
    expect(recomputeOrderFulfillment).toHaveBeenCalledWith(sql, "o-1");
  });

  it("rethrows a transaction failure", async () => {
    const sql = makeSql({ invoice_for_cancel: [cancellable], "": [{ productId: "p1", packSizeLitres: 1, brand: null, qtyUnits: "1" }] });
    (sql as unknown as { transaction: () => Promise<unknown> }).transaction = () => {
      throw new Error("db boom");
    };
    await expect(cancelInvoice(sql, "u", "inv-1", "duplicate")).rejects.toThrow("db boom");
  });

  it("enforces not-found / already-cancelled / non-generated / no-godown", async () => {
    await expect(cancelInvoice(makeSql({ invoice_for_cancel: [] }), "u", "x", "r")).rejects.toMatchObject({ status: 404 });
    await expect(cancelInvoice(makeSql({ invoice_for_cancel: [{ ...cancellable, docStatus: "cancelled" }] }), "u", "x", "r")).rejects.toMatchObject({ status: 409 });
    await expect(cancelInvoice(makeSql({ invoice_for_cancel: [{ ...cancellable, invoiceSource: "uploaded" }] }), "u", "x", "r")).rejects.toMatchObject({ status: 409 });
    await expect(cancelInvoice(makeSql({ invoice_for_cancel: [{ ...cancellable, locationId: null }] }), "u", "x", "r")).rejects.toMatchObject({ status: 409 });
  });
});

describe("getInvoiceItems", () => {
  it("maps items with nullable brand/segment/mrp", async () => {
    const sql = makeSql({
      invoice_items_detail: [
        { description: "Titan", packSizeLitres: "1", brand: "Fuchs", segment: "Car", hsnCode: "2710", qtyUnits: "2", rate: "100", mrp: "120", discountPct: "0", taxableAmount: "200", gstRate: "18", cgst: "18", sgst: "18", igst: "0", lineTotal: "236" },
        { description: "Bulk", packSizeLitres: "5", brand: null, segment: null, hsnCode: "2710", qtyUnits: "1", rate: "50", mrp: null, discountPct: "0", taxableAmount: "50", gstRate: "18", cgst: "4.5", sgst: "4.5", igst: "0", lineTotal: "59" },
      ],
    });
    const items = await getInvoiceItems(sql, "inv-1");
    expect(items[0]).toMatchObject({ description: "Titan", brand: "Fuchs", mrp: 120 });
    expect(items[1]).toMatchObject({ brand: null, segment: null, mrp: null });
  });
});

describe("getInvoicePdfData", () => {
  const header = {
    invoiceNumber: "SA/2026-27/00001",
    invoiceDate: "2026-06-01",
    placeOfSupply: null,
    supplyType: "intra",
    buyerStateCode: "36",
    invoiceSource: "generated",
    docStatus: "final",
    taxable: "200",
    totalDiscount: "0",
    cgst: "18",
    sgst: "18",
    igst: "0",
    grand: "236",
    totalLitres: "2",
    irn: null,
    ewayBillNo: null,
    transport: null,
    vehicleNo: null,
    grRrNo: null,
    station: null,
    reverseCharge: false,
    salesmanName: "Asha",
    customerName: "Ravi Motors",
    customerGstin: "36ABCDE1234F1Z5",
    customerPan: null,
    customerEmail: null,
    addressStreet: "Main Rd",
    addressCity: "Hyderabad",
    addressLandmark: null,
    addressState: "Telangana",
    addressPincode: "500001",
    phone: "999",
  };

  it("assembles seller/buyer/lines/totals", async () => {
    const sql = makeSql({ invoice_pdf_header: [header], invoice_items_detail: [] });
    const data = await getInvoicePdfData(sql, "inv-1");
    expect(data.company).toMatchObject({ name: "Distribution OS" });
    expect(data.buyer.name).toBe("Ravi Motors");
    expect(data.buyer.address).toBe("Main Rd, Hyderabad, Telangana");
    expect(data.totals).toMatchObject({ taxable: 200, grand: 236 });
  });

  it("404s when missing and 409s for a non-generated invoice", async () => {
    await expect(getInvoicePdfData(makeSql({ invoice_pdf_header: [] }), "x")).rejects.toMatchObject({ status: 404 });
    await expect(
      getInvoicePdfData(makeSql({ invoice_pdf_header: [{ ...header, invoiceSource: "uploaded" }] }), "x"),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("getGeneratedInvoiceForEdit", () => {
  const payload = {
    invoiceNumber: "SA/2026-27/00001",
    invoiceDate: "2026-06-01",
    invoiceSource: "generated",
    docStatus: "final",
    amountCollected: "0",
    orderId: null,
    placeOfSupply: null,
    irn: null,
    ewayBillNo: null,
    transport: null,
    vehicleNo: null,
    grRrNo: null,
    station: null,
    reverseCharge: false,
    customerId: CUST,
    customerName: "Ravi Motors",
    locationId: "loc-1",
    locationName: "Main Godown",
  };

  it("returns the editable header + lines", async () => {
    const sql = makeSql({
      invoice_for_edit_payload: [payload],
      invoice_edit_lines: [{ productId: "p1", productName: "Titan", packSizeLitres: "1", brand: "Fuchs", segment: "Car", hsnCode: "2710", qtyUnits: "2", rate: "100", mrp: null, discountPct: "0", orderItemId: null }],
    });
    const out = await getGeneratedInvoiceForEdit(sql, "inv-1");
    expect(out).toMatchObject({ invoiceNumber: "SA/2026-27/00001", editable: true });
    expect(out.lines[0]).toMatchObject({ productId: "p1", qty: 2, orderItemId: null });
  });

  it("404s/409s on missing / non-generated / cancelled", async () => {
    await expect(getGeneratedInvoiceForEdit(makeSql({ invoice_for_edit_payload: [] }), "x")).rejects.toMatchObject({ status: 404 });
    await expect(getGeneratedInvoiceForEdit(makeSql({ invoice_for_edit_payload: [{ ...payload, invoiceSource: "uploaded" }] }), "x")).rejects.toMatchObject({ status: 409 });
    await expect(getGeneratedInvoiceForEdit(makeSql({ invoice_for_edit_payload: [{ ...payload, docStatus: "cancelled" }] }), "x")).rejects.toMatchObject({ status: 409 });
  });
});

describe("getInvoicePdfBytes", () => {
  const pdfSql = (seId: string | null) =>
    makeSql({
      invoice_pdf_auth: [{ invoiceNumber: "SA/2026-27/00001", seId }],
      invoice_pdf_header: [{ invoiceNumber: "SA/2026-27/00001", invoiceDate: "2026-06-01", supplyType: "intra", invoiceSource: "generated", docStatus: "final", taxable: "200", totalDiscount: "0", cgst: "18", sgst: "18", igst: "0", grand: "236", totalLitres: "2", reverseCharge: false, customerName: "Ravi", addressStreet: "Rd", addressCity: "Hyd", addressState: "TS" }],
      invoice_items_detail: [],
    });

  it("renders the PDF for an office role and returns a safe filename", async () => {
    const res = await getInvoicePdfBytes(pdfSql("se-1"), { userId: "admin", role: "SUPER_ADMIN" }, "inv-1");
    expect(res.fileName).toBe("SA_2026-27_00001.pdf");
    expect(res.bytes).toBeInstanceOf(ArrayBuffer);
    expect(buildInvoiceDoc).toHaveBeenCalled();
  });

  it("404s a missing invoice and an SE that does not own it", async () => {
    await expect(getInvoicePdfBytes(makeSql({ invoice_pdf_auth: [] }), { userId: "u", role: "SUPER_ADMIN" }, "x")).rejects.toMatchObject({ status: 404 });
    await expect(
      getInvoicePdfBytes(pdfSql("se-other"), { userId: "se-mine", role: "SALES_EXECUTIVE" }, "inv-1"),
    ).rejects.toMatchObject({ status: 404 });
  });
});
