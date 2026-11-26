import { describe, expect, it } from "vitest";
import { parseQty, SEGMENT_ORDER } from "./types";

describe("parseQty", () => {
  it("accepts whole numbers >= 1", () => {
    expect(parseQty("1")).toBe(1);
    expect(parseQty("10")).toBe(10);
  });
  it("rejects zero and negatives", () => {
    expect(parseQty("0")).toBeNull();
    expect(parseQty("-3")).toBeNull();
  });
  it("rejects non-integers", () => {
    expect(parseQty("2.5")).toBeNull();
  });
  it("rejects empty and non-numeric input", () => {
    expect(parseQty("")).toBeNull();
    expect(parseQty("abc")).toBeNull();
  });
});

describe("SEGMENT_ORDER", () => {
  it("lists the catalogue segments with Car first and Grease last", () => {
    expect(SEGMENT_ORDER[0]).toBe("Car");
    expect(SEGMENT_ORDER).toContain("Gear Oil");
    expect(SEGMENT_ORDER.at(-1)).toBe("Grease");
  });
});
