import { describe, expect, it } from "vitest";
import { toDate, toValue } from "./date-picker-utils";

describe("toDate / toValue", () => {
  it("round-trips a YYYY-MM-DD at local midnight", () => {
    const d = toDate("2026-07-18")!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6); // July (0-indexed)
    expect(d.getDate()).toBe(18);
    expect(toValue(d)).toBe("2026-07-18");
  });
  it("is undefined/empty for blank or invalid input", () => {
    expect(toDate("")).toBeUndefined();
    expect(toDate("not-a-date")).toBeUndefined();
    expect(toValue(undefined)).toBe("");
  });
  it("zero-pads single-digit months and days", () => {
    expect(toValue(new Date(2026, 0, 3))).toBe("2026-01-03");
  });
});
