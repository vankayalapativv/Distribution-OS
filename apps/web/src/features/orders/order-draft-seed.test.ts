import { describe, expect, it } from "vitest";
import { isLocked, seedOilLines, seedLockedLines } from "./order-draft-seed";
import type { EditableOrder } from "./order-draft-types";

type Item = EditableOrder["items"][number];
const item = (over: Partial<Item>): Item => ({
  productId: null, quantityUnits: 1, packSizeLitres: null, segment: null, ...over,
});

const order: EditableOrder = {
  id: "o1",
  customerId: "c1",
  salesExecutiveId: "se1",
  orderDate: "2026-03-01",
  items: [
    item({ productId: "p1", packSizeLitres: 1, segment: "Car", quantityUnits: 5 }), // oil, unlocked
    item({ productId: "p2", quantityUnits: 3, invoicedUnits: 2, orderItemId: "oi2", label: "Oil2" }), // oil, locked
    item({ productId: "p3", quantityUnits: 1, invoicedUnits: 1 }), // oil, locked (no id/label)
  ],
};

describe("isLocked", () => {
  it("is true only when some units are already invoiced", () => {
    expect(isLocked(item({ invoicedUnits: 2 }))).toBe(true);
    expect(isLocked(item({ invoicedUnits: 0 }))).toBe(false);
    expect(isLocked(item({}))).toBe(false);
  });
});

describe("seed*", () => {
  it("seeds only the UN-invoiced oil lines, defaulting segment/pack", () => {
    expect(seedOilLines(order)).toMatchObject([{ segment: "Car", productId: "p1", packSizeLitres: 1, quantityUnits: 5 }]);
    const bare = { ...order, items: [item({ productId: "p9", quantityUnits: 2 })] };
    expect(seedOilLines(bare)[0]).toMatchObject({ segment: "", packSizeLitres: 0 });
  });

  it("seeds locked lines from every invoiced line, defaulting id/label", () => {
    expect(seedLockedLines(order)).toEqual([
      { orderItemId: "oi2", label: "Oil2", brand: null, segment: null, packSizeLitres: null, invoicedUnits: 2, deliveredUnits: 0, orderedUnits: 3, quantityUnits: "3" },
      { orderItemId: "", label: "Item", brand: null, segment: null, packSizeLitres: null, invoicedUnits: 1, deliveredUnits: 0, orderedUnits: 1, quantityUnits: "1" },
    ]);
  });
});
