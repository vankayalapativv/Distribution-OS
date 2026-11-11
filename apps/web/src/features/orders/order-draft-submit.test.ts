import { describe, expect, it } from "vitest";
import { collectDraftItems, validateDraft, buildOrderPayload } from "./order-draft-submit";
import type { LineItemDraft } from "./orders-create-helpers";
import type { LockedLine } from "./order-draft-types";
import type { Product } from "./orders-api";

const oil = (over: Partial<LineItemDraft>): LineItemDraft => ({ uid: crypto.randomUUID(), segment: "", productId: "", packSizeLitres: 0, quantityUnits: 1, ...over });
const locked = (over: Partial<LockedLine>): LockedLine => ({ orderItemId: "oi", label: "L", invoicedUnits: 2, quantityUnits: "5", ...over });
const products: Product[] = [
  { id: "p1", productName: "Oil 1", unit: "litres", segments: ["Car"], packSizes: [1, 5] },
  { id: "p2", productName: "Oil 2", unit: "litres", segments: ["Car"], packSizes: [1] },
  { id: "q1", productName: "Grease", unit: "quantity", segments: ["Car"], packSizes: [] },
];

describe("collectDraftItems", () => {
  it("keeps complete litres lines and quantity lines (no pack)", () => {
    const r = collectDraftItems(
      [
        oil({ productId: "p1", packSizeLitres: 1 }), // litres, has pack → kept
        oil({ productId: "", packSizeLitres: 1 }), // no product → dropped
        oil({ productId: "p2", packSizeLitres: 0 }), // litres, no pack → dropped
        oil({ productId: "q1", packSizeLitres: 0 }), // quantity, no pack → kept
      ],
      products,
    );
    expect(r.validItems).toHaveLength(2);
    expect(r.validItems.map((i) => i.productId)).toEqual(["p1", "q1"]);
  });

  it("drops a line whose quantity is zero or negative (never submitted)", () => {
    const r = collectDraftItems(
      [
        oil({ productId: "p1", packSizeLitres: 1, quantityUnits: 0 }), // blank/zero qty → dropped
        oil({ productId: "p2", packSizeLitres: 1, quantityUnits: -3 }), // negative → dropped
        oil({ productId: "p1", packSizeLitres: 1, quantityUnits: 2 }), // valid → kept
      ],
      products,
    );
    expect(r.validItems).toHaveLength(1);
    expect(r.validItems[0].quantityUnits).toBe(2);
  });
});

const base = { validItems: [oil({ productId: "p1", packSizeLitres: 1 })], lockedLines: [] };

describe("validateDraft", () => {
  it("passes a valid draft (incl. a whole locked line at/above its billed amount)", () => {
    expect(validateDraft(base)).toBeNull();
    expect(validateDraft({ ...base, lockedLines: [locked({ quantityUnits: "5", invoicedUnits: 3 })] })).toBeNull();
  });

  it("rejects an empty draft", () => {
    expect(validateDraft({ ...base, validItems: [] })).toMatch(/at least one oil/);
  });

  it("rejects a locked line below its billed amount or non-integer", () => {
    expect(validateDraft({ ...base, lockedLines: [locked({ label: "Oil2", invoicedUnits: 3, quantityUnits: "2" })] })).toMatch(
      /Oil2: quantity must be a whole number of at least 3/,
    );
    expect(validateDraft({ ...base, lockedLines: [locked({ quantityUnits: "2.5", invoicedUnits: 0 })] })).toMatch(/whole number/);
  });
});

describe("buildOrderPayload", () => {
  it("assembles new + locked lines and formats the date", () => {
    const payload = buildOrderPayload({
      selectedCustomerId: "c1",
      selectedSalesExecId: "se1",
      orderDate: new Date(2026, 2, 1),
      validItems: [
        oil({ productId: "p1", packSizeLitres: 1, segment: "Car", quantityUnits: 5 }),
        oil({ productId: "q1", packSizeLitres: 0, segment: "Car", quantityUnits: 3 }),
      ],
      lockedLines: [locked({ orderItemId: "oi2", quantityUnits: "3" })],
      products,
    });
    expect(payload).toMatchObject({ customerId: "c1", salesExecutiveId: "se1", orderDate: "2026-03-01" });
    expect(payload.items).toEqual([
      { segment: "Car", productId: "p1", packSizeLitres: 1, quantityUnits: 5 },
      { segment: "Car", productId: "q1", packSizeLitres: null, quantityUnits: 3 },
      { orderItemId: "oi2", quantityUnits: 3 },
    ]);
  });

  it("nulls a blank sales-exec / date / segment", () => {
    const payload = buildOrderPayload({
      selectedCustomerId: "c1",
      selectedSalesExecId: "",
      orderDate: undefined,
      validItems: [oil({ productId: "p1", packSizeLitres: 1, segment: "" })],
      lockedLines: [],
      products,
    });
    expect(payload.salesExecutiveId).toBeNull();
    expect(payload.orderDate).toBeNull();
    expect(payload.items[0]).toMatchObject({ segment: null });
  });
});
