import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiRequest = vi.fn();
vi.mock("@/lib/api-client", () => ({
  apiRequest: (...a: unknown[]) => apiRequest(...a),
  errorMessage: (_e: unknown, fallback: string) => fallback,
}));
const draftClear = vi.fn();
vi.mock("@/components/form/use-form-draft", () => ({
  readDraft: () => null,
  useFormDraft: () => ({ clear: draftClear }),
}));

import { useCollectionCreate } from "./use-collection-create";

const config = { apiBaseUrl: "http://api", authToken: "tok" };
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}
const setup = (onDone = vi.fn(), onCreated = vi.fn()) =>
  renderHook(() => useCollectionCreate({ open: true, actionConfig: config, onDone, onCreated }), { wrapper });

beforeEach(() => {
  apiRequest.mockResolvedValue({ id: "col1" });
  vi.stubGlobal("crypto", { ...globalThis.crypto, randomUUID: () => "uuid-x" });
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true })));
});
afterEach(() => {
  vi.unstubAllGlobals();
  apiRequest.mockClear();
  draftClear.mockClear();
});

describe("useCollectionCreate", () => {
  it("cannot submit until customer, collector, amount and proof are present", () => {
    const { result } = setup();
    expect(result.current.canSubmit).toBe(false);
    act(() => result.current.setForm((f) => ({ ...f, customerId: "cu1", collectedByUserId: "u1", collectionAmount: "50" })));
    act(() => result.current.setProofFile(new File(["x"], "p.png", { type: "image/png" })));
    expect(result.current.canSubmit).toBe(true);
  });

  it("errors (no create call) when proof is missing", async () => {
    const { result } = setup();
    await act(async () => result.current.handleCreate({ preventDefault: vi.fn() } as never));
    expect(result.current.error).toMatch(/Attach the payment proof/);
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("creates the collection, uploads proof, clears the draft and closes", async () => {
    const onDone = vi.fn();
    const onCreated = vi.fn();
    const { result } = setup(onDone, onCreated);
    act(() => result.current.setForm((f) => ({ ...f, customerId: "cu1", collectedByUserId: "u1", collectionAmount: "50" })));
    act(() => result.current.setProofFile(new File(["x"], "p.png", { type: "image/png" })));
    await act(async () => result.current.handleCreate({ preventDefault: vi.fn() } as never));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(apiRequest).toHaveBeenCalledWith(config, "POST", "/collections", expect.objectContaining({ customerId: "cu1", clientUuid: "uuid-x" }));
    expect(fetch).toHaveBeenCalledWith("http://api/collections/col1/proof", expect.objectContaining({ method: "POST" }));
    expect(draftClear).toHaveBeenCalled();
    expect(onCreated).toHaveBeenCalled();
  });

  it("surfaces a failed proof upload as an error", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve(null) })));
    const { result } = setup();
    act(() => result.current.setForm((f) => ({ ...f, customerId: "cu1", collectedByUserId: "u1", collectionAmount: "50" })));
    act(() => result.current.setProofFile(new File(["x"], "p.png", { type: "image/png" })));
    await act(async () => result.current.handleCreate({ preventDefault: vi.fn() } as never));
    await waitFor(() => expect(result.current.error).toBeTruthy());
  });
});
