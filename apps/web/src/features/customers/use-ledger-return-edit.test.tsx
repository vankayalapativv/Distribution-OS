import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type FormEvent, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn(async (..._a: unknown[]) => ({ salesReturn: retData }));
vi.mock("@/lib/api-client", () => ({
  apiGet: (...a: unknown[]) => apiGet(...a),
  errorMessage: (e: unknown, f: string) => (e instanceof Error ? e.message : f),
}));

import { useLedgerReturnEdit } from "./use-ledger-return-edit";

const retData = {
  id: "ret1",
  invoiceId: "inv1",
  invoiceNumber: "INV-1",
  returnDate: "2026-07-01",
  reason: null,
  availableOutstanding: 500,
  lines: [{ orderItemId: "a", kind: "oil", segment: "Cars", description: "Oil", unitPrice: 100, returnableUnits: 5 }],
  currentItems: [{ orderItemId: "a", quantityUnits: 1 }],
};
const cfg = { apiBaseUrl: "http://api", authToken: "t" };
const wrap = (qc: QueryClient) => ({ children }: { readonly children: ReactNode }) =>
  createElement(QueryClientProvider, { client: qc }, children);
const ev = () => ({ preventDefault: vi.fn() }) as unknown as FormEvent<HTMLFormElement>;
const setup = () => {
  const onSaved = vi.fn();
  const onOpenChange = vi.fn();
  const { result } = renderHook(
    () => useLedgerReturnEdit({ returnId: "ret1", actionConfig: cfg, onSaved, onOpenChange }),
    { wrapper: wrap(new QueryClient({ defaultOptions: { queries: { retry: false } } })) },
  );
  return { result, onSaved, onOpenChange };
};

beforeEach(() => vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({}) }))));
afterEach(() => {
  apiGet.mockClear();
  vi.unstubAllGlobals();
});

describe("useLedgerReturnEdit", () => {
  it("seeds the qty from currentItems and computes the total", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.qty.a).toBe("1"));
    expect(result.current.total).toBe(100);
    expect(result.current.overCap).toBe(false);
  });

  it("PATCHes multipart on submit (with reason + proof), then saves + closes", async () => {
    const { result, onSaved, onOpenChange } = setup();
    await waitFor(() => expect(result.current.qty.a).toBe("1"));
    act(() => {
      result.current.setReason("damaged");
      result.current.setProofFile(new File(["x"], "p.png", { type: "image/png" }));
    });
    await act(async () => {
      await result.current.handleSubmit(ev());
    });
    expect(fetch).toHaveBeenCalledWith("http://api/sales-returns/ret1", expect.objectContaining({ method: "PATCH" }));
    expect(onSaved).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("clears the seed marker on close", async () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useLedgerReturnEdit({ returnId: id, actionConfig: cfg, onSaved: vi.fn(), onOpenChange: vi.fn() }),
      {
        wrapper: wrap(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
        initialProps: { id: "ret1" as string | null },
      },
    );
    await waitFor(() => expect(result.current.qty.a).toBe("1"));
    act(() => rerender({ id: null }));
    expect(result.current.open).toBe(false);
  });

  it("blocks submit when nothing is entered", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.qty.a).toBe("1"));
    act(() => result.current.setQty(() => ({ a: "0" })));
    await act(async () => {
      await result.current.handleSubmit(ev());
    });
    expect(result.current.error).toBe("Enter a return quantity on at least one line.");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("surfaces a server error message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({ error: { message: "Nope" } }) })));
    const { result } = setup();
    await waitFor(() => expect(result.current.qty.a).toBe("1"));
    await act(async () => {
      await result.current.handleSubmit(ev());
    });
    expect(result.current.error).toBe("Nope");
  });

  it("falls back to a default message when the error body is unparseable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => { throw new Error("bad json"); } })));
    const { result } = setup();
    await waitFor(() => expect(result.current.qty.a).toBe("1"));
    await act(async () => {
      await result.current.handleSubmit(ev());
    });
    expect(result.current.error).toBe("Failed to save the sales return.");
  });
});
