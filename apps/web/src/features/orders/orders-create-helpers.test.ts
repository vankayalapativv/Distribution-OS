import { describe, expect, it } from "vitest";
import {
  SEGMENT_OPTIONS,
  emptyLineItem,
  oilLineView,
} from "./orders-create-helpers";

describe("create helpers factories", () => {
  it("offers the oil segments and a blank line draft", () => {
    expect(SEGMENT_OPTIONS.map((s) => s.value)).toContain("Gear Oil");
    expect(emptyLineItem()).toMatchObject({ segment: "", productId: "", packSizeLitres: 0, quantityUnits: 1 });
    expect(typeof emptyLineItem().uid).toBe("string");
  });
});

describe("oilLineView", () => {
  const products = [
    { id: "p1", packSizes: [1, 5] },
    { id: "p2", packSizes: [20] },
  ];

  it("returns the selected product's pack sizes", () => {
    const v = oilLineView({ uid: "t", brand: "", segment: "", productId: "p1", packSizeLitres: 0, quantityUnits: 1 }, products);
    expect(v.packOptions).toEqual([1, 5]);
  });

  it("gives no pack options when no product is selected or it is unknown", () => {
    expect(oilLineView(emptyLineItem(), products).packOptions).toEqual([]);
    expect(
      oilLineView({ uid: "t", brand: "", segment: "", productId: "nope", packSizeLitres: 0, quantityUnits: 1 }, products).packOptions,
    ).toEqual([]);
  });

  it("computes total litres only once both pack size and quantity are positive", () => {
    expect(oilLineView({ uid: "t", brand: "", segment: "", productId: "p2", packSizeLitres: 20, quantityUnits: 3 }, products).lineLitres).toBe(60);
    expect(oilLineView({ uid: "t", brand: "", segment: "", productId: "p2", packSizeLitres: 0, quantityUnits: 3 }, products).lineLitres).toBeNull();
    expect(oilLineView({ uid: "t", brand: "", segment: "", productId: "p2", packSizeLitres: 20, quantityUnits: 0 }, products).lineLitres).toBeNull();
  });
});
