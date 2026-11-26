import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCatalogue } from "./use-catalogue";
import type { OrderCart } from "./use-order-cart";
import type { Product } from "./types";

const PRODUCTS: Product[] = [
  { id: "titan", productName: "Titan Engine", brand: "Fuchs", unit: "litres", segments: ["Car"], packSizes: [1, 5] },
  { id: "agri", productName: "Agri Super", brand: "Fuchs", unit: "litres", segments: ["Agri"], packSizes: [20] },
  { id: "gear", productName: "Gear X", brand: "Savsol", unit: "litres", segments: ["Gear Oil"], packSizes: [1] },
];

function stubCart() {
  const addProductLine = vi.fn();
  return { cart: { addProductLine } as unknown as OrderCart, addProductLine };
}

function setup(products = PRODUCTS) {
  const { cart, addProductLine } = stubCart();
  const view = renderHook(() => useCatalogue({ products, cart }));
  return { ...view, addProductLine };
}

describe("useCatalogue", () => {
  it("lists distinct brands alphabetically and defaults to the first", () => {
    const { result } = setup();
    expect(result.current.availableBrands).toEqual(["Fuchs", "Savsol"]);
    expect(result.current.brand).toBe("Fuchs");
  });

  it("shows only the selected brand's products and segment chips", () => {
    const { result } = setup();
    expect(result.current.filteredProducts.map((p) => p.id)).toEqual(["titan", "agri"]);
    expect(result.current.availableSegments).toEqual(["Car", "Agri"]);
  });

  it("selectBrand switches brand and clears the segment filter", () => {
    const { result } = setup();
    act(() => result.current.setSegmentFilter("Car"));
    act(() => result.current.selectBrand("Savsol"));
    expect(result.current.brand).toBe("Savsol");
    expect(result.current.segmentFilter).toBeNull();
    expect(result.current.filteredProducts.map((p) => p.id)).toEqual(["gear"]);
  });

  it("filters by search text and by segment", () => {
    const { result } = setup();
    act(() => result.current.setSearch("agri"));
    expect(result.current.filteredProducts.map((p) => p.id)).toEqual(["agri"]);
    act(() => result.current.setSearch(""));
    act(() => result.current.setSegmentFilter("Car"));
    expect(result.current.filteredProducts.map((p) => p.id)).toEqual(["titan"]);
  });

  it("addOrOpen quick-adds a no-choice product straight to the cart", () => {
    const { result, addProductLine } = setup();
    act(() => result.current.addOrOpen(PRODUCTS[1])); // agri: 1 pack, 1 segment
    expect(addProductLine).toHaveBeenCalledWith("agri", 20, "Agri", 1);
    expect(result.current.sheetProduct).toBeNull();
  });

  it("addOrOpen opens the pack sheet for a product with a choice, and remembers the pack", () => {
    const { result, addProductLine } = setup();
    act(() => result.current.addOrOpen(PRODUCTS[0])); // titan: 2 packs
    expect(result.current.sheetProduct?.id).toBe("titan");
    expect(result.current.defaultPack).toBe(1); // first pack before any memory

    act(() => result.current.addFromSheet(5, "Car", 2));
    expect(addProductLine).toHaveBeenCalledWith("titan", 5, "Car", 2);

    // Close the sheet, then re-open the same product: it preselects the
    // remembered pack (5), not the first pack.
    act(() => result.current.setSheetProduct(null));
    act(() => result.current.addOrOpen(PRODUCTS[0]));
    expect(result.current.defaultPack).toBe(5);
  });

  it("addFromSheet is a no-op when no sheet product is open", () => {
    const { result, addProductLine } = setup();
    act(() => result.current.addFromSheet(5, "Car", 1));
    expect(addProductLine).not.toHaveBeenCalled();
  });

  it("ignores brandless products when listing brands", () => {
    const brandless: Product = { id: "x", productName: "Loose", brand: null, unit: "litres", segments: ["Car"], packSizes: [1] };
    const { result } = setup([PRODUCTS[0], brandless]);
    expect(result.current.availableBrands).toEqual(["Fuchs"]);
  });

  it("has no brand, segments or products when the catalogue is empty", () => {
    const { result } = setup([]);
    expect(result.current.availableBrands).toEqual([]);
    expect(result.current.brand).toBeNull();
    expect(result.current.availableSegments).toEqual([]);
    expect(result.current.filteredProducts).toEqual([]);
  });

  it("adds a quantity product from the sheet without remembering a pack", () => {
    const quantity: Product = {
      id: "grease",
      productName: "Grease Tub",
      brand: "Fuchs",
      unit: "quantity",
      segments: ["Car", "2W"], // >1 segment → opens the sheet
      packSizes: [],
    };
    const { result, addProductLine } = setup([quantity]);
    act(() => result.current.addOrOpen(quantity));
    expect(result.current.sheetProduct?.id).toBe("grease");
    expect(result.current.defaultPack).toBeNull();
    act(() => result.current.addFromSheet(null, "Car", 2));
    expect(addProductLine).toHaveBeenCalledWith("grease", null, "Car", 2);
  });
});
