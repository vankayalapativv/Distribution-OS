import { describe, it, expect } from "vitest";
import { backfillLineSegments, isPricedLine, toGenerateLines, initialFormLines } from "./invoice-generate-api";
import type { InvoiceFormLine, InvoiceEditData, OrderInvoiceSeed } from "./invoice-generate-api";
import type { Sku } from "@/features/stock/stock-api";

const formLine = (over: Partial<InvoiceFormLine> = {}): InvoiceFormLine => ({
  uid: "u", productId: "p", productName: "P", packSizeLitres: 1, brand: null, segment: null, hsnCode: null,
  qty: "0", rate: "", mrp: "", discountPct: "0", orderItemId: null, maxUnits: null, ...over,
});
const sku = (over: Partial<Sku> = {}): Sku =>
  ({ productId: "p", productName: "P", brand: "Fuchs", hsnCode: null, packSizeLitres: 1, unit: "litres", segment: "Car", ...over } as Sku);

describe("isPricedLine", () => {
  it("is true only for a complete, priced line (SKU + pack + qty + rate)", () => {
    expect(isPricedLine(formLine({ productId: "p1", packSizeLitres: 5, qty: "3", rate: "100" }))).toBe(true);
  });
  it("is false without a SKU, even when qty and rate are set", () => {
    expect(isPricedLine(formLine({ productId: "", qty: "3", rate: "100" }))).toBe(false);
  });
  it("is false with no pack, zero qty, blank rate, or zero rate", () => {
    expect(isPricedLine(formLine({ productId: "p1", packSizeLitres: 0, qty: "3", rate: "100" }))).toBe(false);
    expect(isPricedLine(formLine({ productId: "p1", packSizeLitres: 5, qty: "0", rate: "100" }))).toBe(false);
    expect(isPricedLine(formLine({ productId: "p1", packSizeLitres: 5, qty: "3", rate: "" }))).toBe(false);
    expect(isPricedLine(formLine({ productId: "p1", packSizeLitres: 5, qty: "3", rate: "0" }))).toBe(false);
  });
});

describe("toGenerateLines", () => {
  it("drops incomplete / unpriced lines", () => {
    expect(toGenerateLines([
      formLine(),
      formLine({ qty: "2", rate: "" }),
      formLine({ productId: "", qty: "2", rate: "5" }),
      formLine({ qty: "0", rate: "5" }),
      formLine({ packSizeLitres: 0, qty: "2", rate: "5" }),
    ])).toEqual([]);
  });
  it("maps a complete priced line to the API shape", () => {
    expect(
      toGenerateLines([formLine({ productId: "p1", packSizeLitres: 5, qty: "3", rate: "100", mrp: "120", discountPct: "10", brand: "B", segment: "Car", hsnCode: "H", orderItemId: "oi" })]),
    ).toEqual([
      { productId: "p1", packSizeLitres: 5, brand: "B", segment: "Car", hsnCode: "H", qtyUnits: 3, rate: 100, mrp: 120, discountPct: 10, orderItemId: "oi" },
    ]);
  });
  it("sends mrp null when the mrp field is blank", () => {
    expect(toGenerateLines([formLine({ qty: "1", rate: "5", mrp: "" })])[0].mrp).toBeNull();
  });
});

describe("backfillLineSegments", () => {
  const skus: Sku[] = [
    sku({ productId: "solo", segment: "Gear Oil", packSizeLitres: 5 }),
    sku({ productId: "solo", segment: "Gear Oil", packSizeLitres: 20 }), // same single segment, two packs
    sku({ productId: "multi", segment: "3W" }),
    sku({ productId: "multi", segment: "Commercial" }),
  ];

  it("returns the same reference when no line needs a segment", () => {
    const lines = [formLine({ productId: "solo", segment: "Gear Oil" })];
    expect(backfillLineSegments(lines, skus)).toBe(lines);
  });
  it("fills a single-segment product's missing segment", () => {
    const out = backfillLineSegments([formLine({ productId: "solo", segment: null })], skus);
    expect(out[0].segment).toBe("Gear Oil");
  });
  it("leaves a multi-segment product blank (needs an explicit pick)", () => {
    const out = backfillLineSegments([formLine({ productId: "multi", segment: null })], skus);
    expect(out[0].segment).toBeNull();
  });
  it("does not touch a line that already has a segment, or one with no product", () => {
    const out = backfillLineSegments(
      [formLine({ productId: "solo", segment: "Car" }), formLine({ productId: "", segment: null })],
      skus,
    );
    expect(out[0].segment).toBe("Car");
    expect(out[1].segment).toBeNull();
  });
});

describe("initialFormLines", () => {
  it("is empty with neither edit nor seed", () => {
    expect(initialFormLines(null, null)).toEqual([]);
  });
  it("maps edit lines (numbers to strings, no max cap)", () => {
    const edit = { lines: [{ productId: "p", productName: "P", packSizeLitres: 5, brand: null, segment: null, hsnCode: null, qty: 4, rate: 50, mrp: 60, discountPct: 0, orderItemId: "oi" }] } as unknown as InvoiceEditData;
    const [l] = initialFormLines(edit, null);
    expect(l).toMatchObject({ productId: "p", qty: "4", rate: "50", mrp: "60", discountPct: "0", orderItemId: "oi", maxUnits: null });
    expect(typeof l.uid).toBe("string");
  });
  it("maps seed lines (blank rate, remaining units as the cap)", () => {
    const seed = { lines: [{ productId: "p", productName: "P", packSizeLitres: 5, brand: null, segment: null, hsnCode: null, qty: "7", orderItemId: "oi", remainingUnits: 7 }] } as unknown as OrderInvoiceSeed;
    const [l] = initialFormLines(null, seed);
    expect(l).toMatchObject({ productId: "p", qty: "7", rate: "", mrp: "", maxUnits: 7 });
  });
});
