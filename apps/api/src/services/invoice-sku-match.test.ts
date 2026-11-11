import { describe, expect, it } from "vitest";
import { lineMatchesSku, nameMatches, normalizePhone } from "./invoice-sku-match";
import type { InvoiceLineItem, MatchSku } from "./invoice-sku-match";

const line = (over: Partial<InvoiceLineItem> = {}): InvoiceLineItem => ({
  description: "Titan 15W-40 Engine Oil",
  hsn: "27101980",
  quantity: 2,
  mrp: null,
  price: null,
  amount: null,
  litres: 10, // → pack 5
  kind: "oil",
  ...over,
});
const sku = (over: Partial<MatchSku> = {}): MatchSku => ({
  label: "Titan 15W40",
  hsnCode: "27101980",
  packSizeLitres: 5,
  ...over,
});

describe("normalizePhone", () => {
  it("returns the last 10 digits, tolerant of +91/spaces/dashes and null", () => {
    expect(normalizePhone("+91 98765 43210")).toBe("9876543210");
    expect(normalizePhone("98-76-5432-10")).toBe("9876543210");
    expect(normalizePhone(null)).toBe("");
  });
});

describe("nameMatches", () => {
  it("is true when ≥50% of the shorter name's tokens overlap", () => {
    expect(nameMatches("Titan GT1", "Titan GT1 Premium")).toBe(true);
  });
  it("is false for empty names or weak overlap", () => {
    expect(nameMatches("", "Titan")).toBe(false);
    expect(nameMatches("Alpha Beta", "Gamma Delta")).toBe(false);
  });
});

describe("lineMatchesSku", () => {
  it("rejects on a missing or mismatched HSN", () => {
    expect(lineMatchesSku(line({ hsn: null }), sku())).toBe(false);
    expect(lineMatchesSku(line({ hsn: "38200000" }), sku())).toBe(false);
  });

  it("matches a graded oil on grade + pack size", () => {
    expect(lineMatchesSku(line(), sku())).toBe(true);
  });

  it("rejects a graded oil on pack mismatch, missing pack, or grade mismatch", () => {
    expect(lineMatchesSku(line({ litres: 20 }), sku())).toBe(false); // pack 10 ≠ 5
    expect(lineMatchesSku(line({ litres: null }), sku())).toBe(false); // no pack from the line
    expect(lineMatchesSku(line(), sku({ packSizeLitres: null }))).toBe(false); // no pack on the SKU
    expect(lineMatchesSku(line({ description: "Titan 10W-30" }), sku())).toBe(false); // grade differs
  });

  it("matches an SAE-graded oil", () => {
    expect(lineMatchesSku(line({ description: "Gear SAE 90", litres: 10 }), sku({ label: "Gear SAE90" }))).toBe(true);
  });

  it("falls back to name overlap for grade-less (HSN-pinned) products", () => {
    const coolant = sku({ label: "Coolant Green", hsnCode: "38200000", packSizeLitres: null });
    expect(lineMatchesSku(line({ description: "Coolant Green Premium", hsn: "38200000" }), coolant)).toBe(true);
    expect(lineMatchesSku(line({ description: "Brake Fluid Dot4", hsn: "38200000" }), coolant)).toBe(false);
  });
});
