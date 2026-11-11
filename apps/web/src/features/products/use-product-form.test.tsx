import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FormEvent } from "react";
import type { ManagedProduct, ProductPack } from "./products-api";

const apiRequest = vi.fn();
const invalidateQueries = vi.fn();
vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...actual, apiRequest: (...a: unknown[]) => apiRequest(...a) };
});
// useQuery backs the live duplicate-name check; an empty result turns it off so
// these tests exercise pure field validation.
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries }),
  useQuery: () => ({ data: undefined }),
}));

import { ApiRequestError } from "@/lib/api-client";
import { computeFieldErrors, useProductForm, validateProductForm } from "./use-product-form";

const pack = { packSizeMl: 1000, mrp: 100, mop: 90 } as unknown as ProductPack;
const valid = { name: "Fuchs 10W40", brand: "Fuchs", hsnCode: "27101980", unit: "litres" as const, segments: ["Car"], packs: [pack] };
const target: ManagedProduct = {
  id: "p1", productName: "Old", brand: "Shell", hsnCode: "38201000", unit: "litres", segments: ["2W"], packs: [pack],
} as unknown as ManagedProduct;

const onOpenChange = vi.fn();
const config = { apiBaseUrl: "", authToken: "" };
const setup = (open = true, edit: ManagedProduct | null = null) =>
  renderHook(({ o, e }) => useProductForm(o, e, onOpenChange, config), { initialProps: { o: open, e: edit } });
const submit = () => ({ preventDefault: vi.fn() }) as unknown as FormEvent<HTMLFormElement>;

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

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

describe("useProductForm", () => {
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

  it("toggles a segment on and off", () => {
    const { result } = setup();
    act(() => result.current.toggleSegment("Car"));
    expect(result.current.segments).toEqual(["Car"]);
    act(() => result.current.toggleSegment("Car"));
    expect(result.current.segments).toEqual([]);
  });

  it("blocks submit on an incomplete form, returning the first bad field", async () => {
    const { result } = setup();
    let res: { ok: boolean; field?: string } | undefined;
    await act(async () => {
      res = await result.current.handleSubmit(submit());
    });
    expect(res).toEqual({ ok: false, field: "name" });
    expect(result.current.fieldErrors.name).toMatch(/name is required/i);
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("POSTs a new product, invalidates queries and closes", async () => {
    apiRequest.mockResolvedValueOnce({ product: target });
    const { result } = setup();
    act(() => {
      result.current.setProductName(" Fuchs 10W40 ");
      result.current.setBrand("Fuchs");
      result.current.setHsnCode("27101980");
      result.current.toggleSegment("Car");
      result.current.setPacks([pack]);
    });
    await act(async () => result.current.handleSubmit(submit()));
    expect(apiRequest).toHaveBeenCalledWith(config, "POST", "/products", {
      productName: "Fuchs 10W40", brand: "Fuchs", hsnCode: "27101980", unit: "litres", segments: ["Car"], packs: [pack],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["products"] });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("POSTs a quantity product with no packs", async () => {
    apiRequest.mockResolvedValueOnce({ product: target });
    const { result } = setup();
    act(() => {
      result.current.setProductName("Texspin Gear Oil 6203");
      result.current.setBrand("Texspin");
      result.current.setHsnCode("84821000");
      result.current.setUnit("quantity");
      result.current.toggleSegment("Car");
      result.current.setPacks([pack]); // should be dropped for quantity
    });
    await act(async () => result.current.handleSubmit(submit()));
    expect(apiRequest).toHaveBeenCalledWith(config, "POST", "/products", {
      productName: "Texspin Gear Oil 6203", brand: "Texspin", hsnCode: "84821000", unit: "quantity", segments: ["Car"], packs: [],
    });
  });

  it("PATCHes when editing", async () => {
    apiRequest.mockResolvedValueOnce({ product: target });
    const { result } = setup(true, target);
    await act(async () => result.current.handleSubmit(submit()));
    expect(apiRequest).toHaveBeenCalledWith(config, "PATCH", "/products/p1", expect.objectContaining({ productName: "Old" }));
  });

  it("surfaces a general API error and stays open", async () => {
    apiRequest.mockRejectedValueOnce(new Error("The server is taking too long."));
    const { result } = setup(true, target);
    await act(async () => result.current.handleSubmit(submit()));
    await waitFor(() => expect(result.current.error).toBe("The server is taking too long."));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("maps a 409 duplicate to the name field, not a general error", async () => {
    apiRequest.mockRejectedValueOnce(new ApiRequestError('Product "Old" already exists.', 409));
    const { result } = setup(true, target);
    let res: { ok: boolean; field?: string } | undefined;
    await act(async () => {
      res = await result.current.handleSubmit(submit());
    });
    expect(res).toEqual({ ok: false, field: "name" });
    await waitFor(() => expect(result.current.fieldErrors.name).toMatch(/already exists/i));
    expect(result.current.error).toBeNull();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
