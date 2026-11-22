import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiRequest = vi.fn();
const invalidateQueries = vi.fn();
vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...actual, apiRequest: (...a: unknown[]) => apiRequest(...a) };
});
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries }), useQuery: () => ({ data: undefined }) }));

import { ApiRequestError } from "@/lib/api-client";
import { config, onOpenChange, pack, setup, submit, target } from "./use-product-form.test-kit";

beforeEach(() => vi.clearAllMocks());

describe("useProductForm — submit & errors", () => {
  it("touch() clears that field's server error and any general error", async () => {
    apiRequest.mockRejectedValueOnce(new ApiRequestError('Product "Old" already exists.', 409));
    const { result } = setup(true, target);
    await act(async () => result.current.handleSubmit(submit()));
    await waitFor(() => expect(result.current.fieldErrors.name).toMatch(/already exists/i));
    act(() => result.current.touch("name"));
    expect(result.current.fieldErrors.name).toBeUndefined(); // "Old" is otherwise valid
  });

  it("touch() clears a lingering general error", async () => {
    apiRequest.mockRejectedValueOnce(new Error("Network down."));
    const { result } = setup(true, target);
    await act(async () => result.current.handleSubmit(submit()));
    await waitFor(() => expect(result.current.error).toBe("Network down."));
    act(() => result.current.touch("brand"));
    expect(result.current.error).toBeNull();
  });

  it("blocks submit on an incomplete form, returning the first bad field", async () => {
    const { result } = setup();
    let res: { ok: boolean; field?: string } | undefined;
    await act(async () => { res = await result.current.handleSubmit(submit()); });
    expect(res).toEqual({ ok: false, field: "name" });
    expect(result.current.fieldErrors.name).toMatch(/name is required/i);
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("POSTs a new product, invalidates queries and closes", async () => {
    apiRequest.mockResolvedValueOnce({ product: target });
    const { result } = setup();
    act(() => {
      const r = result.current;
      r.setProductName(" Fuchs 10W40 "); r.setBrand("Fuchs"); r.setHsnCode("27101980"); r.toggleSegment("Car"); r.setPacks([pack]);
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
      const r = result.current;
      r.setProductName("Texspin Gear Oil 6203"); r.setBrand("Texspin"); r.setHsnCode("84821000"); r.setUnit("quantity"); r.toggleSegment("Car"); r.setPacks([pack]);
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
    await act(async () => { res = await result.current.handleSubmit(submit()); });
    expect(res).toEqual({ ok: false, field: "name" });
    await waitFor(() => expect(result.current.fieldErrors.name).toMatch(/already exists/i));
    expect(result.current.error).toBeNull();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
