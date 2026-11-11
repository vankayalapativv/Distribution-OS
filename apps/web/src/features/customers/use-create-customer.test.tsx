import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type FormEvent, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn(async (..._a: unknown[]) => ({ salesExecutives: [{ id: "u1", name: "Ravi" }] }));
const apiRequest = vi.fn(async (..._a: unknown[]) => ({}));
vi.mock("@/lib/api-client", () => ({
  apiGet: (...a: unknown[]) => apiGet(...a),
  apiRequest: (...a: unknown[]) => apiRequest(...a),
  errorMessage: (_e: unknown, f: string) => f,
}));

import { useCreateCustomer } from "./use-create-customer";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const wrap = (qc: QueryClient) => ({ children }: { readonly children: ReactNode }) =>
  createElement(QueryClientProvider, { client: qc }, children);

// A fake submit event whose currentTarget carries the legalName + phone fields.
const submitEvent = () => {
  const form = document.createElement("form");
  form.innerHTML =
    '<input name="legalName" value="Raj Motors"><input name="phone" value="9876543210">';
  return { preventDefault: vi.fn(), currentTarget: form } as unknown as FormEvent<HTMLFormElement>;
};

const setup = () => {
  const onOpenChange = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(qc, "invalidateQueries");
  const { result } = renderHook(() => useCreateCustomer(cfg, onOpenChange), { wrapper: wrap(qc) });
  return { result, onOpenChange, invalidate };
};

afterEach(() => {
  apiRequest.mockClear();
  apiGet.mockClear();
});

describe("useCreateCustomer", () => {
  it("loads the sales executives from the query", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.salesExecutives).toEqual([{ id: "u1", name: "Ravi" }]));
  });

  it("blocks submission with a validation error and does not POST", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.handleCreate(submitEvent());
    });
    expect(result.current.error).toBe("Select at least one segment.");
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("POSTs a valid customer then invalidates + closes + resets", async () => {
    const { result, onOpenChange, invalidate } = setup();
    act(() => {
      result.current.setCustomerType("retail");
      result.current.setSegments(["Car"]);
      result.current.setSalesExecutiveId("u1");
    });
    await act(async () => {
      await result.current.handleCreate(submitEvent());
    });
    expect(apiRequest).toHaveBeenCalledWith(
      cfg,
      "POST",
      "/customers",
      expect.objectContaining({ legalName: "Raj Motors", salesExecutiveId: "u1", segment: "Car" }),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["customers"] });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(result.current.segments).toEqual([]); // reset
  });

  it("surfaces a create error", async () => {
    apiRequest.mockRejectedValueOnce(new Error("no"));
    const { result } = setup();
    act(() => {
      result.current.setCustomerType("retail");
      result.current.setSegments(["Car"]);
      result.current.setSalesExecutiveId("u1");
    });
    await act(async () => {
      await result.current.handleCreate(submitEvent());
    });
    expect(result.current.error).toBe("Failed to create customer.");
  });

  it("reset clears the controlled fields", () => {
    const { result } = setup();
    act(() => {
      result.current.setSegments(["Car"]);
      result.current.reset();
    });
    expect(result.current.segments).toEqual([]);
    expect(result.current.customerType).toBe("");
  });
});
