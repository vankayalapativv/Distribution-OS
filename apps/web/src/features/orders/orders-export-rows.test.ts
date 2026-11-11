import { describe, expect, it } from "vitest";
import { buildRows } from "./orders-export-rows";
import type { Order, OrderItem } from "./orders-api";

function item(over: Partial<OrderItem>): OrderItem {
  return {
    id: "i", productId: null, productName: null,     brand: null,
    quantityUnits: 0, packSizeLitres: null, totalLitres: null, segment: null, hsnCode: null,
    ...over,
  };
}

function order(over: Partial<Order>): Order {
  return {
    id: "o", orderCode: "ORD-0001", orderDate: "2026-08-01", customerId: "c",
    customerName: "Acme Motors", addressCity: "Khammam", segment: null, customerType: null, customerPhone: "+919999999999",
    salesExecutiveId: "s", salesExecutiveName: "Murali", orderStatus: "approved",
    approvalStatus: "approved", origin: "standard", discountAmount: null, totalTaxableAmount: null,
    totalGstAmount: null, totalInvoiceValue: null, totalLitres: null, deliveryAddress: null,
    deliveryNotes: null, remarks: null, createdBy: null, invoiceId: null, invoiceCode: null,
    firstInvoiceNumber: null, invoiceCount: 0, invoices: [], delivered: false,
    fulfillmentStatus: "ordered", returnedUnits: 0, returnedLitres: 0, fullyInvoiced: false, items: [], createdAt: "2026-08-01T00:00:00Z",
    ...over,
  };
}

describe("buildRows — one row per order, SKUs comma-joined", () => {
  it("a multi-SKU order is a single row with commas in Products and Qty", () => {
    const rows = buildRows([
      order({
        items: [
          item({ productName: "TITAN 5W-30", packSizeLitres: 3.5, totalLitres: 14 }),
          item({ productName: "SYN SP 0W-20", packSizeLitres: 1, totalLitres: 4 }),
        ],
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0][8]).toBe("TITAN 5W-30 3.5L, SYN SP 0W-20 1L");
    expect(rows[0][9]).toBe("14 L, 4 L");
  });

  it("an oil without a pack size uses just its name", () => {
    const rows = buildRows([order({ items: [item({ productName: "GEAR 90", packSizeLitres: null, totalLitres: 5 })] })]);
    expect(rows[0][8]).toBe("GEAR 90");
  });

  it("an item-less order still yields one row with an em dash", () => {
    const rows = buildRows([order({ items: [] })]);
    expect(rows).toHaveLength(1);
    expect(rows[0][8]).toBe("—");
    expect(rows[0][9]).toBe("—");
  });

  it("a non-litres oil line shows its quantity in pieces", () => {
    const rows = buildRows([order({ items: [item({ productName: "Grease", totalLitres: null, quantityUnits: 5 })] })]);
    expect(rows[0][8]).toBe("Grease");
    expect(rows[0][9]).toBe("5");
  });

  it("em-dashes a blank (whitespace-only) field", () => {
    expect(buildRows([order({ customerName: "   " })])[0][3]).toBe("—");
  });

  it("tolerates a null items field (older API response)", () => {
    expect(buildRows([order({ items: null as unknown as [] })])[0][8]).toBe("—");
  });

  it("prefers firstInvoiceNumber, falls back to invoiceCode, then em dash", () => {
    expect(buildRows([order({ firstInvoiceNumber: "INV-1" })])[0][2]).toBe("INV-1");
    expect(buildRows([order({ firstInvoiceNumber: null, invoiceCode: "IC-9" })])[0][2]).toBe("IC-9");
    expect(buildRows([order({ firstInvoiceNumber: null, invoiceCode: null })])[0][2]).toBe("—");
  });

  it("labels the fulfillment stage (fallback to the raw value / ordered when null)", () => {
    expect(buildRows([order({ fulfillmentStatus: "delivered" })])[0][7]).toBe("Delivered");
    expect(buildRows([order({ fulfillmentStatus: null })])[0][7]).toBe("Ordered");
    expect(buildRows([order({ fulfillmentStatus: "weird" as never })])[0][7]).toBe("weird");
  });

  it("em-dashes missing customer/city/phone/executive", () => {
    const r = buildRows([order({ customerName: null, addressCity: null, customerPhone: null, salesExecutiveName: null })])[0];
    expect([r[3], r[4], r[5], r[6]]).toEqual(["—", "—", "—", "—"]);
  });
});
