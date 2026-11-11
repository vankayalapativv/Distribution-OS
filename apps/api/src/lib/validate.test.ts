import { describe, expect, it } from "vitest";
import { z } from "zod";
import { assertUuidParam, isUuid, validate, zNonEmpty, zPhone } from "./validate";

const UUID = "11111111-2222-4333-8444-555555555555";

describe("validate", () => {
  it("returns parsed data on success", () => {
    expect(validate(z.object({ a: z.number() }), { a: 1 })).toEqual({ a: 1 });
  });

  it("throws 422 naming the first offending field (with path)", () => {
    expect(() => validate(z.object({ name: zNonEmpty }), { name: "" })).toThrowError(/name:/);
  });

  it("throws 422 with the plain message when the issue has no path", () => {
    let err: unknown;
    try {
      validate(z.string(), 5);
    } catch (e) {
      err = e;
    }
    expect(err).toMatchObject({ code: "INVALID_FIELD", status: 422 });
  });
});

describe("isUuid", () => {
  it("accepts a valid UUID and rejects anything else", () => {
    expect(isUuid(UUID)).toBe(true);
    expect(isUuid("parts")).toBe(false);
    expect(isUuid(123)).toBe(false);
  });
});

describe("assertUuidParam", () => {
  it("returns the id when valid", () => {
    expect(assertUuidParam(UUID, "Order")).toBe(UUID);
  });

  it("throws 404 for a non-UUID param", () => {
    let err: unknown;
    try {
      assertUuidParam("parts", "Order");
    } catch (e) {
      err = e;
    }
    expect(err).toMatchObject({ code: "NOT_FOUND", status: 404 });
  });
});

describe("zPhone", () => {
  it("accepts a 10+ digit number (tolerating +91/spaces)", () => {
    expect(zPhone.safeParse("+91 98765 43210").success).toBe(true);
  });

  it("rejects a number with fewer than 10 digits", () => {
    expect(zPhone.safeParse("123").success).toBe(false);
  });
});
