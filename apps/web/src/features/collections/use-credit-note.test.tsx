import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiRequest = vi.fn();
const apiGet = vi.fn();
vi.mock("@/lib/api-client", () => ({
  apiRequest: (...a: unknown[]) => apiRequest(...a),
  apiGet: (...a: unknown[]) => apiGet(...a),
  errorMessage: (_e: unknown, fallback: string) => fallback,
}));

import { useCreditNote } from "./use-credit-note";

const config = { apiBaseUrl: "http://api", authToken: "tok" };
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);
const setup = (onDone = vi.fn(), onCreated = vi.fn()) =>
  renderHook(() => useCreditNote({ open: true, customerId: "cu1", actionConfig: config, onDone, onCreated }), { wrapper });

beforeEach(() => {
  apiRequest.mockResolvedValue({ id: "col1" });
  apiGet.mockResolvedValue([]);
  vi.stubGlobal("crypto", { ...globalThis.crypto, randomUUID: () => "uuid-x" });
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true })));
});
afterEach(() => { vi.unstubAllGlobals(); apiRequest.mockReset(); });

describe("useCreditNote", () => {
  it("requires issuer, invoice and a positive amount to submit", () => {
    const { result } = setup();
    expect(result.current.canSubmit).toBe(false);
    act(() => result.current.set({ collectedByUserId: "u1", invoiceId: "inv1", amount: "500" }));
    expect(result.current.canSubmit).toBe(true);
  });

  it("errors without creating when no invoice is chosen", async () => {
    const { result } = setup();
    act(() => result.current.set({ collectedByUserId: "u1", amount: "500" }));
    await act(async () => result.current.handleCreate({ preventDefault: vi.fn() } as never));
    expect(result.current.error).toMatch(/Select the invoice/);
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("creates a credit-note collection and closes on success", async () => {
    const onDone = vi.fn();
    const { result } = setup(onDone);
    act(() => result.current.set({ collectedByUserId: "u1", invoiceId: "inv1", amount: "500" }));
    await act(async () => result.current.handleCreate({ preventDefault: vi.fn() } as never));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(apiRequest).toHaveBeenCalledWith(config, "POST", "/collections", expect.objectContaining({ paymentMode: "credit_note", invoiceId: "inv1" }));
  });
});
