import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useQuery: () => ({ data: undefined }),
}));

import { computeFieldErrors, validateProductForm } from "./use-product-form";
import { pack, setup, target, valid } from "./use-product-form.test-kit";

beforeEach(() => vi.clearAllMocks());

describe("validateProductForm", () => {
  it("passes a complete form and flags each missing field in order", () => {
    expect(validateProductForm(valid)).toBeNull();
    expect(validateProductForm({ ...valid, name: "" })).toMatch(/name is required/i);
    expect(validateProductForm({ ...valid, brand: "" })).toMatch(/brand/i);
    expect(validateProductForm({ ...valid, hsnCode: "" })).toMatch(/HSN code is required/i);
    expect(validateProductForm({ ...valid, hsnCode: "2710" })).toMatch(/exactly 8 digits/i);
    expect(validateProductForm({ ...valid, hsnCode: "123456789" })).toMatch(/exactly 8 digits/i);
    expect(validateProductForm({ ...valid, segments: [] })).toMatch(/at least one segment/i);
    expect(validateProductForm({ ...valid, packs: [] })).toMatch(/at least one pack/i);
  });

  it("does not require packs for a quantity product", () => {
    expect(validateProductForm({ ...valid, unit: "quantity", packs: [] })).toBeNull();
  });

  it("flags a name already in the catalogue (normalized match)", () => {
    const names = new Set(["Fuchs 10W40"]);
    // Extra/invisible whitespace still matches the stored name.
    expect(computeFieldErrors({ ...valid, name: "Fuchs  10W40 " }, names).name).toMatch(/already in the catalogue/i);
    // A different name is fine.
    expect(computeFieldErrors({ ...valid, name: "Fuchs 20W50" }, names).name).toBeUndefined();
  });
});

describe("useProductForm — seeding & field state", () => {
  it("seeds blank on create and the target's values on edit", () => {
    const { result } = setup(true, null);
    expect(result.current.productName).toBe("");
    expect(result.current.segments).toEqual([]);
    const edit = setup(true, target);
    expect(edit.result.current.productName).toBe("Old");
    expect(edit.result.current.brand).toBe("Shell");
    expect(edit.result.current.hsnCode).toBe("38201000");
    expect(edit.result.current.segments).toEqual(["2W"]);
  });

  it("seeds nothing while closed", () => {
    const { result } = setup(false, target);
    expect(result.current.productName).toBe("");
    expect(result.current.segments).toEqual([]);
  });

  it("does not reseed when the dialog closes (open → false)", () => {
    const { result, rerender } = setup(true, null);
    act(() => result.current.setProductName("Draft"));
    rerender({ o: false, e: null }); // key flips to null, but the open-guard skips reseeding
    expect(result.current.productName).toBe("Draft");
  });

  it("toggles a segment on and off", () => {
    const { result } = setup();
    act(() => result.current.toggleSegment("Car"));
    expect(result.current.segments).toEqual(["Car"]);
    act(() => result.current.toggleSegment("Car"));
    expect(result.current.segments).toEqual([]);
  });

  it("isStepValid reflects per-step validity and tolerates an unknown step", () => {
    const { result } = setup();
    expect(result.current.isStepValid(0)).toBe(false); // name/brand/hsn still blank
    act(() => {
      result.current.setProductName("Fuchs 10W40");
      result.current.setBrand("Fuchs");
      result.current.setHsnCode("27101980");
    });
    expect(result.current.isStepValid(0)).toBe(true);
    expect(result.current.isStepValid(99)).toBe(true); // no fields → vacuously valid
  });

  it("keeps a reference to a seeded pack for edits", () => {
    const { result } = setup(true, target);
    expect(result.current.packs).toEqual([pack]);
  });
});
