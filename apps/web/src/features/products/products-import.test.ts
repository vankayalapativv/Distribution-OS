import { describe, expect, it } from "vitest";
import { parseProductsRows } from "./products-import";

const row = (over: Record<string, string> = {}): Record<string, string> => ({
  "Product Name": "Fuchs Titan 5W-30", Brand: "Fuchs", Unit: "litres",
  Segments: "Car, 2W", HSN: "27101980", "Pack Size (L)": "5", ...over,
});

describe("parseProductsRows", () => {
  it("skips blank-name, absent-name and the example 'delete this row' rows", () => {
    expect(parseProductsRows([
      {},
      row({ "Product Name": "" }),
      row({ "Product Name": "Example Oil (delete this row)" }),
    ])).toEqual([]);
  });

  it("merges rows sharing name+brand into one product, one pack each (sorted intake)", () => {
    const out = parseProductsRows([row({ "Pack Size (L)": "5" }), row({ "Pack Size (L)": "1" })]);
    expect(out).toHaveLength(1);
    expect(out[0].product.packs).toEqual([{ packSize: 5 }, { packSize: 1 }]);
    expect(out[0].error).toBeNull();
  });

  it("normalises the name (NBSP → space, collapses runs, trims)", () => {
    const out = parseProductsRows([row({ "Product Name": "  Fuchs  Titan   5W-30 " })]);
    expect(out[0].product.productName).toBe("Fuchs Titan 5W-30");
  });

  it("parses a quantity product (no pack rows, error-free)", () => {
    const out = parseProductsRows([row({ Unit: "quantity", Segments: "Car", "Pack Size (L)": "", HSN: "63079090" })]);
    expect(out[0].product.unit).toBe("quantity");
    expect(out[0].product.packs).toEqual([]);
    expect(out[0].error).toBeNull();
  });

  it("drops non-positive pack sizes on a litres product", () => {
    const out = parseProductsRows([row({ "Pack Size (L)": "0" }), row({ "Pack Size (L)": "-2" })]);
    expect(out[0].product.packs).toEqual([]);
    expect(out[0].error).toBe("Add at least one pack size.");
  });

  it("splits segments on , ; / | and de-duplicates", () => {
    const out = parseProductsRows([row({ Segments: "Car; 2W/Car|3W" })]);
    expect(out[0].product.segments).toEqual(["Car", "2W", "3W"]);
  });

  it.each([
    [{ Brand: "" }, "Brand is required."],
    [{ HSN: "123" }, "HSN must be exactly 8 digits."],
    [{ Segments: "" }, "Pick at least one segment."],
    [{ Segments: "Spaceship" }, "Invalid segment: Spaceship."],
  ])("flags %o as %s", (over, msg) => {
    expect(parseProductsRows([row(over)])[0].error).toBe(msg);
  });

  it("defaults a missing/empty Unit to litres", () => {
    expect(parseProductsRows([row({ Unit: "" })])[0].product.unit).toBe("litres");
  });

  it("tolerates a row missing every column but the name (all cells default)", () => {
    const out = parseProductsRows([{ "Product Name": "Lonely Product" }]);
    expect(out[0].product).toMatchObject({ brand: "", hsnCode: "", unit: "litres", segments: [], packs: [] });
    expect(out[0].error).toBe("Brand is required.");
  });
});
