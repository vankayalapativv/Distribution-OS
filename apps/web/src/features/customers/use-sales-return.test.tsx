import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type FormEvent, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn(async (..._a: unknown[]) => ({}));
vi.mock("@/lib/api-client", () => ({
  apiGet: (...a: unknown[]) => apiGet(...a),
  errorMessage: (e: unknown, f: string) => (e instanceof Error ? e.message : f),
}));

import { useSalesReturn } from "./use-sales-return";

const cfg = { apiBaseUrl: "http://api", authToken: "t" };
const returnable = {
  invoice: { id: "inv1", invoiceNumber: "INV-1", invoiceDate: "2026-07-01", outstandingAmount: 500 },
  lines: [{ orderItemId: "a", kind: "oil", segment: "Cars", description: "Oil", unitPrice: 100, returnableUnits: 5, packLitresPerUnit: 1, billedUnits: 5, returnedUnits: 0 }],
};
const wrap = (qc: QueryClient) => ({ children }: { readonly children: ReactNode }) =>
  createElement(QueryClientProvider, { client: qc }, children);
const ev = () => ({ preventDefault: vi.fn() }) as unknown as FormEvent<HTMLFormElement>;
const setup = () => {
  const onCreated = vi.fn();
  const onOpenChange = vi.fn();
  const { result } = renderHook(
    () => useSalesReturn({ open: true, customerId: "c1", actionConfig: cfg, onCreated, onOpenChange }),
    { wrapper: wrap(new QueryClient({ defaultOptions: { queries: { retry: false } } })) },
  );
  return { result, onCreated, onOpenChange };
};

beforeEach(() => {
  apiGet.mockImplementation(async (..._a: unknown[]) => {
    const url = _a[1] as string;
    if (url.endsWith("/invoices")) return { invoices: [{ id: "inv1", invoiceNumber: "INV-1", invoiceDate: "2026-07-01", outstandingAmount: 500 }] };
    return returnable;
  });
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({}) })));
});
afterEach(() => {
  apiGet.mockReset();
  vi.unstubAllGlobals();
});

describe("useSalesReturn", () => {
  it("loads outstanding invoices, then returnable lines after picking one", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.invoicesQ.data?.invoices).toHaveLength(1));
    act(() => result.current.pickInvoice("inv1"));
    await waitFor(() => expect(result.current.lines).toHaveLength(1));
    expect(result.current.outstanding).toBe(500);
  });

  it("computes the running total + over-cap flag", async () => {
    const { result } = setup();
    act(() => result.current.pickInvoice("inv1"));
    await waitFor(() => expect(result.current.lines).toHaveLength(1));
    act(() => result.current.setQty(() => ({ a: "6" }))); // 6×100 = 600 > 500
    expect(result.current.total).toBe(600);
    expect(result.current.overCap).toBe(true);
  });

  it("POSTs a valid return then creates + closes", async () => {
    const { result, onCreated, onOpenChange } = setup();
    act(() => result.current.pickInvoice("inv1"));
    await waitFor(() => expect(result.current.lines).toHaveLength(1));
    act(() => result.current.setQty(() => ({ a: "2" })));
    await act(async () => {
      await result.current.handleSubmit(ev());
    });
    expect(fetch).toHaveBeenCalledWith("http://api/sales-returns", expect.objectContaining({ method: "POST" }));
    expect(onCreated).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("blocks an empty return and surfaces a server error", async () => {
    const { result } = setup();
    act(() => result.current.pickInvoice("inv1"));
    await waitFor(() => expect(result.current.lines).toHaveLength(1));
    await act(async () => {
      await result.current.handleSubmit(ev());
    });
    expect(result.current.error).toBe("Enter a return quantity on at least one line.");

    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({ error: { message: "Server no" } }) })));
    act(() => result.current.setQty(() => ({ a: "2" })));
    await act(async () => {
      await result.current.handleSubmit(ev());
    });
    expect(result.current.error).toBe("Server no");
  });

  it("falls back to a default message when the error body is unparseable", async () => {
    const { result } = setup();
    act(() => result.current.pickInvoice("inv1"));
    await waitFor(() => expect(result.current.lines).toHaveLength(1));
    act(() => result.current.setQty(() => ({ a: "2" })));
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => { throw new Error("bad"); } })));
    await act(async () => {
      await result.current.handleSubmit(ev());
    });
    expect(result.current.error).toBe("Failed to record the sales return.");
  });

  it("resets the form and clears the picked invoice", async () => {
    const { result } = setup();
    act(() => result.current.pickInvoice("inv1"));
    await waitFor(() => expect(result.current.lines).toHaveLength(1));
    act(() => result.current.reset());
    expect(result.current.invoiceId).toBe("");
    expect(result.current.reason).toBe("");
  });
});
