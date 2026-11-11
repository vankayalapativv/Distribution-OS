import { describe, expect, it } from "vitest";
import {
  isOverCap,
  lineCategory,
  lineTotal,
  returnItems,
  returnTotal,
  round2,
  seedReturn,
  validateReturn,
  type ReturnForEdit,
  type ReturnLine,
} from "./sales-return-edit-logic";

const line = (over: Partial<ReturnLine> = {}): ReturnLine => ({
  orderItemId: "oi1",
  kind: "oil",
  segment: "Cars",
  description: "Oil 5L",
  unitPrice: 100,
  returnableUnits: 5,
  ...over,
});

describe("round2 / lineCategory", () => {
  it("rounds to 2dp", () => {
    expect(round2(100.126)).toBe(100.13);
    expect(round2(3)).toBe(3);
  });
  it("labels oils by segment (fallback Oil)", () => {
    expect(lineCategory(line())).toBe("Cars");
    expect(lineCategory(line({ segment: null }))).toBe("Oil");
  });
});

describe("lineTotal / returnTotal", () => {
  it("computes a line's value and zeroes blank/invalid qty", () => {
    expect(lineTotal(line(), "2")).toBe(200);
    expect(lineTotal(line(), "")).toBe(0);
    expect(lineTotal(line(), "0")).toBe(0);
  });
  it("sums every line", () => {
    const lines = [line({ orderItemId: "a" }), line({ orderItemId: "b", unitPrice: 50 })];
    expect(returnTotal(lines, { a: "2", b: "3" })).toBe(200 + 150);
  });
});

describe("returnItems", () => {
  it("keeps only positive lines and ignores lines with no entered qty", () => {
    const lines = [line({ orderItemId: "a" }), line({ orderItemId: "b" }), line({ orderItemId: "c" })];
    expect(returnItems(lines, { a: "2", b: "0" })).toEqual([{ orderItemId: "a", quantityUnits: 2 }]);
  });
});

describe("isOverCap", () => {
  it("flags a total above the available (with epsilon)", () => {
    expect(isOverCap(100.01, 100)).toBe(true);
    expect(isOverCap(100, 100)).toBe(false);
  });
});

describe("seedReturn", () => {
  it("derives date, reason and per-item quantities", () => {
    const ret = {
      returnDate: "2026-07-01T00:00:00.000Z",
      reason: null,
      currentItems: [{ orderItemId: "a", quantityUnits: 2 }],
    } as unknown as ReturnForEdit;
    expect(seedReturn(ret)).toEqual({ date: "2026-07-01", reason: "", qty: { a: "2" } });
  });
});

describe("validateReturn", () => {
  it("requires a line, then blocks over-cap, else passes", () => {
    expect(validateReturn(0, false)).toBe("Enter a return quantity on at least one line.");
    expect(validateReturn(1, true)).toBe("Return total exceeds the invoice's outstanding balance.");
    expect(validateReturn(1, false)).toBeNull();
  });
});
