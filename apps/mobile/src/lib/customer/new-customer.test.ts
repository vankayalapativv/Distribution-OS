import { describe, expect, it } from "vitest";
import { CUSTOMER_SEGMENTS, CUSTOMER_TYPES, EMAIL_RE, EMPTY_CUSTOMER } from "./new-customer";

describe("new-customer constants", () => {
  it("EMAIL_RE accepts valid addresses and rejects malformed ones", () => {
    expect(EMAIL_RE.test("a@b.com")).toBe(true);
    expect(EMAIL_RE.test("first.last@shop.co.in")).toBe(true);
    expect(EMAIL_RE.test("nope")).toBe(false);
    expect(EMAIL_RE.test("a@b")).toBe(false);
    expect(EMAIL_RE.test("a b@c.com")).toBe(false);
  });

  it("lists the customer types and segments", () => {
    expect(CUSTOMER_TYPES.map((t) => t.value)).toEqual(["retail", "mechanic", "lof", "industrial"]);
    expect(CUSTOMER_SEGMENTS).toContain("Car");
  });

  it("EMPTY_CUSTOMER is fully blank", () => {
    expect(EMPTY_CUSTOMER.legalName).toBe("");
    expect(EMPTY_CUSTOMER.segments).toEqual([]);
    expect(EMPTY_CUSTOMER.salesExecutiveId).toBeNull();
  });
});
