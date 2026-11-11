import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type FormEvent, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn(async (..._a: unknown[]) => detailData);
const apiRequest = vi.fn(async (..._a: unknown[]) => ({}));
vi.mock("@/lib/api-client", () => ({
  apiGet: (...a: unknown[]) => apiGet(...a),
  apiRequest: (...a: unknown[]) => apiRequest(...a),
  errorMessage: (_e: unknown, f: string) => f,
}));

import { useLedgerCollectionEdit } from "./use-ledger-collection-edit";

const detailData = {
  id: "col1",
  collectionCode: "COL-1",
  collectionDate: "2026-07-01",
  paymentMode: "upi",
  paymentReferenceNumber: "UTR9",
  collectionAmount: 1500,
  remarks: null,
  accountantApprovalStatus: "verified",
};
const cfg = { apiBaseUrl: "x", authToken: "t" };
const wrap = (qc: QueryClient) => ({ children }: { readonly children: ReactNode }) =>
  createElement(QueryClientProvider, { client: qc }, children);
const ev = () => ({ preventDefault: vi.fn() }) as unknown as FormEvent<HTMLFormElement>;
const setup = (collectionId: string | null = "col1") => {
  const onSaved = vi.fn();
  const onOpenChange = vi.fn();
  const { result } = renderHook(
    () => useLedgerCollectionEdit({ collectionId, actionConfig: cfg, onSaved, onOpenChange }),
    { wrapper: wrap(new QueryClient({ defaultOptions: { queries: { retry: false } } })) },
  );
  return { result, onSaved, onOpenChange };
};

afterEach(() => {
  apiGet.mockClear();
  apiRequest.mockClear();
});

describe("useLedgerCollectionEdit", () => {
  it("does not query while closed", () => {
    setup(null);
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("clears the seed marker when the dialog closes", async () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useLedgerCollectionEdit({ collectionId: id, actionConfig: cfg, onSaved: vi.fn(), onOpenChange: vi.fn() }),
      {
        wrapper: wrap(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
        initialProps: { id: "col1" as string | null },
      },
    );
    await waitFor(() => expect(result.current.amount).toBe("1500"));
    act(() => rerender({ id: null })); // close → prevSeed reset (no throw)
    expect(result.current.open).toBe(false);
  });

  it("seeds the form from the loaded collection and flags verified", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.amount).toBe("1500"));
    expect(result.current.mode).toBe("upi");
    expect(result.current.reference).toBe("UTR9");
    expect(result.current.verified).toBe(true);
  });

  it("validates then PATCHes on submit, saving + closing", async () => {
    const { result, onSaved, onOpenChange } = setup();
    await waitFor(() => expect(result.current.amount).toBe("1500"));
    act(() => result.current.setAmount("2000"));
    await act(async () => {
      await result.current.handleSubmit(ev());
    });
    expect(apiRequest).toHaveBeenCalledWith(
      cfg,
      "PATCH",
      "/collections/col1",
      expect.objectContaining({ collectionAmount: 2000, paymentMode: "upi" }),
    );
    expect(onSaved).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("blocks an invalid amount and surfaces a save error", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.amount).toBe("1500"));
    act(() => result.current.setAmount("0"));
    await act(async () => {
      await result.current.handleSubmit(ev());
    });
    expect(result.current.error).toBe("Enter an amount greater than 0.");
    expect(apiRequest).not.toHaveBeenCalled();

    act(() => result.current.setAmount("500"));
    apiRequest.mockRejectedValueOnce(new Error("no"));
    await act(async () => {
      await result.current.handleSubmit(ev());
    });
    expect(result.current.error).toBe("Failed to save the entry.");
  });
});
