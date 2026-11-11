import { describe, expect, it } from "vitest";
import {
  parseYmd,
  mapFetchedToEditable,
  orderActionFlags,
  type FetchedOrderForEdit,
} from "./orders-list-helpers";
import type { Order } from "./orders-api";

describe("parseYmd", () => {
  it("parses yyyy-MM-dd as a LOCAL date (no UTC day-shift)", () => {
    const d = parseYmd("2026-03-09");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 2, 9]);
  });

  it("defaults missing month/day to 1", () => {
    const d = parseYmd("2026");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 0, 1]);
  });
});

const fetched: FetchedOrderForEdit = {
  id: "o1",
  customerId: "c1",
  customerName: "Raj Motors",
  salesExecutiveId: "se1",
  orderDate: "2026-03-01",
  items: [
    { id: "i1", productId: "p1", quantityUnits: 5, packSizeLitres: 1, segment: "Cars", productName: "Oil A"},
    { id: "i2", productId: null, quantityUnits: 2, packSizeLitres: null, segment: null, productName: null},
    { id: "i3", productId: null, quantityUnits: 1, packSizeLitres: null, segment: null, productName: null},
    { id: "i4", productId: null, quantityUnits: 1, packSizeLitres: null, segment: null, productName: null},
  ],
  skuProgress: [{ orderItemId: "i1", invoicedUnits: 3 }],
};

describe("mapFetchedToEditable", () => {
  it("maps header fields and merges per-line billed units", () => {
    const e = mapFetchedToEditable(fetched);
    expect(e).toMatchObject({ id: "o1", customerId: "c1", customerName: "Raj Motors", salesExecutiveId: "se1", orderDate: "2026-03-01" });
    expect(e.items[0]).toMatchObject({ orderItemId: "i1", productId: "p1", quantityUnits: 5, invoicedUnits: 3, label: "Oil A" });
  });

  it("labels lines by product name, falling back to 'Item', and defaults invoicedUnits to 0", () => {
    const e = mapFetchedToEditable(fetched);
    expect(e.items.map((i) => i.label)).toEqual(["Oil A", "Item", "Item", "Item"]);
    expect(e.items[1].invoicedUnits).toBe(0);
  });

  it("treats a missing skuProgress as no billed lines", () => {
    const e = mapFetchedToEditable({ ...fetched, skuProgress: undefined });
    expect(e.items.every((i) => i.invoicedUnits === 0)).toBe(true);
  });
});

const order = (over: Partial<Order>): Order =>
  ({ orderStatus: "active", fulfillmentStatus: "ordered", fullyInvoiced: false, invoices: [], ...over }) as Order;
const flags = (o: Order, canCreate: boolean, canInvoice: boolean, gen = true) =>
  orderActionFlags(o, { canCreate, canInvoice, invoiceGenerationEnabled: gen });

describe("orderActionFlags", () => {
  it("hides the menu entirely for a delivered (non-cancelled) order", () => {
    expect(flags(order({ fulfillmentStatus: "delivered" }), true, true).hidden).toBe(true);
  });

  it("ordered: SA/Manager gets create-invoice+edit+cancel", () => {
    const f = flags(order({ fulfillmentStatus: "ordered" }), true, true);
    expect(f).toMatchObject({ canGenerate: true, canEdit: true, canCancel: true, hidden: false });
  });

  it("invoiced: accountant may not edit, only cancel is a manager right", () => {
    const f = flags(order({ fulfillmentStatus: "invoiced" }), true, true);
    expect(f).toMatchObject({ canGenerate: false, canEdit: false, canCancel: true });
  });

  it("partially_delivered: accountant (invoice role) may edit the remainder", () => {
    const f = flags(order({ fulfillmentStatus: "partially_delivered" }), false, true);
    expect(f).toMatchObject({ canGenerate: true, canEdit: true, canCancel: false });
  });

  it("cannot create an invoice once fully invoiced", () => {
    expect(flags(order({ fullyInvoiced: true }), true, true).canGenerate).toBe(false);
  });

  it("partially_returned with an un-invoiced remainder still allows Create Invoice", () => {
    expect(flags(order({ fulfillmentStatus: "partially_returned", fullyInvoiced: false }), true, true).canGenerate).toBe(true);
  });

  it("partially_returned that is fully invoiced does NOT allow Create Invoice", () => {
    expect(flags(order({ fulfillmentStatus: "partially_returned", fullyInvoiced: true }), true, true).canGenerate).toBe(false);
  });

  it("returned with an un-invoiced remainder still allows Create Invoice", () => {
    expect(flags(order({ fulfillmentStatus: "returned", fullyInvoiced: false }), true, true).canGenerate).toBe(true);
  });

  it("cancelled order: nothing but the (disabled) manage right; not hidden", () => {
    const f = flags(order({ orderStatus: "cancelled" }), true, true);
    expect(f).toMatchObject({ canGenerate: false, canEdit: false, canCancel: true, hidden: false });
  });

  it("generate is gated behind the flag AND invoice eligibility", () => {
    expect(flags(order({}), true, true, true).canGenerate).toBe(true);
    expect(flags(order({}), true, true, false).canGenerate).toBe(false);
  });

  it("a viewer with no rights sees a hidden menu", () => {
    expect(flags(order({}), false, false).hidden).toBe(true);
  });

  it("treats a null fulfillmentStatus as 'ordered'", () => {
    const f = flags(order({ fulfillmentStatus: null as unknown as Order["fulfillmentStatus"] }), true, true);
    expect(f).toMatchObject({ canGenerate: true, canEdit: true });
  });
});
