import { describe, expect, it } from "vitest";
import { dateStringValue, nullableNumberValue, nullableStringValue, numberValue, stringValue } from "./customers-shared";

describe("customers-shared coercers", () => {
  it("nullableNumberValue: null/number/non-empty-string, else null", () => {
    expect(nullableNumberValue(null)).toBeNull();
    expect(nullableNumberValue(5)).toBe(5);
    expect(nullableNumberValue("5")).toBe(5);
    expect(nullableNumberValue(true)).toBeNull(); // non-number/non-string → null fallback
  });
  it("other coercers", () => {
    expect(dateStringValue(new Date("2026-06-01T10:00:00Z"))).toBe("2026-06-01");
    expect(dateStringValue(5)).toBe("");
    expect(numberValue("3")).toBe(3);
    expect(stringValue(7)).toBe("");
    expect(nullableStringValue("")).toBeNull();
  });
});
