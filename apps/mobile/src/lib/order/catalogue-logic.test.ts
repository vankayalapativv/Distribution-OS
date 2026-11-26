import { describe, expect, it } from "vitest";
import { computeDefaultPack, orderSegments, resolveQuickAdd } from "./catalogue-logic";
import type { Product } from "./types";

function product(over: Partial<Product> = {}): Product {
  return {
    id: "p1",
    productName: "Oil",
    brand: "Fuchs",
    unit: "litres",
    segments: ["Car"],
    packSizes: [1],
    ...over,
  };
}

describe("orderSegments", () => {
  it("keeps the canonical order and appends unknown segments last", () => {
    expect(orderSegments(new Set(["2W", "Car", "Foo", "Gear Oil"]))).toEqual([
      "Car",
      "2W",
      "Gear Oil",
      "Foo",
    ]);
  });
  it("returns empty for an empty set", () => {
    expect(orderSegments(new Set())).toEqual([]);
  });
});

describe("resolveQuickAdd", () => {
  it("quick-adds a quantity product with 0-1 segments", () => {
    expect(resolveQuickAdd(product({ unit: "quantity", segments: ["Car"], packSizes: [] }))).toEqual({
      pack: null,
      segment: "Car",
    });
    expect(resolveQuickAdd(product({ unit: "quantity", segments: [], packSizes: [] }))).toEqual({
      pack: null,
      segment: null,
    });
  });
  it("opens the sheet for a quantity product with multiple segments", () => {
    expect(resolveQuickAdd(product({ unit: "quantity", segments: ["Car", "2W"] }))).toBeNull();
  });
  it("quick-adds a litres product with a single pack and 0-1 segments", () => {
    expect(resolveQuickAdd(product({ unit: "litres", packSizes: [5], segments: [] }))).toEqual({
      pack: 5,
      segment: null,
    });
  });
  it("opens the sheet when there is a pack choice or multiple segments", () => {
    expect(resolveQuickAdd(product({ unit: "litres", packSizes: [1, 5] }))).toBeNull();
    expect(resolveQuickAdd(product({ unit: "litres", packSizes: [1], segments: ["Car", "2W"] }))).toBeNull();
  });
  it("treats a missing packSizes as no packs (opens the sheet)", () => {
    expect(
      resolveQuickAdd({ ...product({ unit: "litres", segments: [] }), packSizes: undefined as unknown as number[] }),
    ).toBeNull();
  });
});

describe("computeDefaultPack", () => {
  it("returns null for a quantity product", () => {
    expect(computeDefaultPack(product({ unit: "quantity", packSizes: [] }), undefined)).toBeNull();
  });
  it("prefers a remembered pack that is still offered", () => {
    expect(computeDefaultPack(product({ packSizes: [1, 5, 10] }), 5)).toBe(5);
  });
  it("falls back to the first pack when the remembered one is gone", () => {
    expect(computeDefaultPack(product({ packSizes: [1, 5] }), 20)).toBe(1);
  });
  it("uses the first pack when nothing is remembered", () => {
    expect(computeDefaultPack(product({ packSizes: [2, 5] }), undefined)).toBe(2);
  });
  it("returns 0 for a litres product with no packs, and for a null product", () => {
    expect(computeDefaultPack(product({ packSizes: [] }), undefined)).toBe(0);
    expect(computeDefaultPack(null, undefined)).toBe(0);
  });
});
