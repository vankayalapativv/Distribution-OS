import { describe, expect, it } from "vitest";
import { ApiRequestError } from "@/lib/api-client";
import {
  FIELD_STEP, computeFieldErrors, fieldForServerError, normalizeProductName, validateProductForm,
} from "./product-form-logic";
import type { ProductPack } from "./products-api";

const pack = { packSize: 5 } as unknown as ProductPack;
const valid = { name: "Fuchs 10W40", brand: "Fuchs", hsnCode: "27101980", unit: "litres" as const, segments: ["Car"], packs: [pack] };

describe("normalizeProductName", () => {
  it("swaps non-breaking spaces, collapses runs and trims", () => {
    expect(normalizeProductName("  Fuchs  10W   40 ")).toBe("Fuchs 10W 40");
  });
});

describe("computeFieldErrors", () => {
  it("passes a complete form", () => {
    expect(computeFieldErrors(valid, new Set())).toEqual({});
  });
  it("flags a duplicate name against existingNames", () => {
    expect(computeFieldErrors(valid, new Set(["fuchs 10w40"]))).toEqual({});     // case differs → not a dup
    expect(computeFieldErrors(valid, new Set(["Fuchs 10W40"])).name).toMatch(/already in the catalogue/);
  });
  it("flags each missing/invalid field", () => {
    expect(computeFieldErrors({ ...valid, name: "  " }, new Set()).name).toMatch(/required/);
    expect(computeFieldErrors({ ...valid, brand: " " }, new Set()).brand).toMatch(/Pick a brand/);
    expect(computeFieldErrors({ ...valid, hsnCode: "" }, new Set()).hsnCode).toMatch(/required/);
    expect(computeFieldErrors({ ...valid, hsnCode: "123" }, new Set()).hsnCode).toMatch(/exactly 8 digits/);
    expect(computeFieldErrors({ ...valid, segments: [] }, new Set()).segments).toMatch(/at least one segment/);
    expect(computeFieldErrors({ ...valid, packs: [] }, new Set()).packs).toMatch(/at least one pack/);
  });
  it("does not require packs for a quantity product", () => {
    expect(computeFieldErrors({ ...valid, unit: "quantity", packs: [] }, new Set()).packs).toBeUndefined();
  });
});

describe("validateProductForm", () => {
  it("returns the first error message, or null", () => {
    expect(validateProductForm(valid)).toBeNull();
    expect(validateProductForm({ ...valid, name: "", brand: "" })).toMatch(/name is required/i);
  });
});

describe("fieldForServerError", () => {
  it("ignores non-ApiRequestError", () => {
    expect(fieldForServerError(new Error("x"))).toBeNull();
  });
  it("maps 409 to name, and 422 to the mentioned field", () => {
    expect(fieldForServerError(new ApiRequestError("dup", 409))).toBe("name");
    expect(fieldForServerError(new ApiRequestError("bad segment", 422))).toBe("segments");
    expect(fieldForServerError(new ApiRequestError("hsn wrong", 422))).toBe("hsnCode");
    expect(fieldForServerError(new ApiRequestError("pack invalid", 422))).toBe("packs");
    expect(fieldForServerError(new ApiRequestError("name taken", 422))).toBe("name");
    expect(fieldForServerError(new ApiRequestError("mystery", 422))).toBeNull();
    expect(fieldForServerError(new ApiRequestError("teapot", 418))).toBeNull();
  });
});

describe("FIELD_STEP", () => {
  it("maps fields to their wizard step", () => {
    expect(FIELD_STEP).toEqual({ name: 0, brand: 0, hsnCode: 0, segments: 1, packs: 2 });
  });
});
