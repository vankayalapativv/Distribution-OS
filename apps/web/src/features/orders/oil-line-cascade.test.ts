import { describe, expect, it } from "vitest";
import { cascadeLineItem, segmentForPickedProduct } from "./oil-line-cascade";
import type { LineItemDraft } from "./orders-create-helpers";

const item = (): LineItemDraft =>
  ({ brand: "Fuchs", segment: "Car", productId: "p1", packSizeLitres: 5, quantityUnits: 2 } as unknown as LineItemDraft);

describe("cascadeLineItem", () => {
  it("brand change clears segment, product and pack", () => {
    expect(cascadeLineItem(item(), "brand", "Savsol")).toMatchObject({
      brand: "Savsol", segment: "", productId: "", packSizeLitres: 0,
    });
  });
  it("segment change clears product and pack (keeps brand)", () => {
    expect(cascadeLineItem(item(), "segment", "2W")).toMatchObject({
      brand: "Fuchs", segment: "2W", productId: "", packSizeLitres: 0,
    });
  });
  it("product change clears only the pack", () => {
    expect(cascadeLineItem(item(), "productId", "p2")).toMatchObject({
      brand: "Fuchs", segment: "Car", productId: "p2", packSizeLitres: 0,
    });
  });
  it("any other field is set as-is", () => {
    expect(cascadeLineItem(item(), "quantityUnits", 7)).toMatchObject({ quantityUnits: 7, productId: "p1" });
  });
});

describe("segmentForPickedProduct", () => {
  it("adopts the product's sole segment when none is chosen", () => {
    expect(segmentForPickedProduct("", ["Gear Oil"])).toBe("Gear Oil");
  });
  it("keeps the chosen segment when the product supports it", () => {
    expect(segmentForPickedProduct("Commercial", ["3W", "Commercial"])).toBe("Commercial");
  });
  it("drops a chosen segment the product does not support, picking its sole one", () => {
    expect(segmentForPickedProduct("Car", ["Gear Oil"])).toBe("Gear Oil");
  });
  it("leaves it blank for a multi-segment product with no valid choice", () => {
    expect(segmentForPickedProduct("", ["3W", "Commercial"])).toBe("");
    expect(segmentForPickedProduct("Car", ["3W", "Commercial"])).toBe("");
  });
  it("leaves it blank when the product has no segments", () => {
    expect(segmentForPickedProduct("", [])).toBe("");
  });
});
