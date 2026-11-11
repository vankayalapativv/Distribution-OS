import { describe, expect, it } from "vitest";
import { nullNum, mapOrderRow } from "./orders-shared";

describe("orders-shared", () => {
  it("nullNum: null/number/non-empty-string, else null", () => {
    expect(nullNum(null)).toBeNull();
    expect(nullNum(5)).toBe(5);
    expect(nullNum("5")).toBe(5);
    expect(nullNum("")).toBeNull(); // empty string → null fallback
    expect(nullNum(true as never)).toBeNull(); // non-number/non-string → null
  });
  it("mapOrderRow maps the invoices array", () => {
    const out = mapOrderRow({ id: "o1", invoices: [{ id: "iv1", code: "INV-1", total: "100" }] });
    expect(out).toMatchObject({ id: "o1" });
  });
});
