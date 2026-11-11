import { describe, expect, it } from "vitest";
import { formatPhone } from "./order-format-phone";

describe("formatPhone", () => {
  it("returns empty for a null/blank number", () => {
    expect(formatPhone(null)).toBe("");
  });

  it("groups a bare 10-digit number as +91 XXXXX XXXXX", () => {
    expect(formatPhone("7893284264")).toBe("+91 78932 84264");
  });

  it("groups a 12-digit 91-prefixed number, ignoring separators", () => {
    expect(formatPhone("+91 78932-84264")).toBe("+91 78932 84264");
  });

  it("falls back to the raw string for anything unrecognisable", () => {
    expect(formatPhone("12345")).toBe("12345");
    expect(formatPhone("001112223333")).toBe("001112223333");
  });
});
