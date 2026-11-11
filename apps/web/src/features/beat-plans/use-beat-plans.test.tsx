import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const apiGet = vi.fn();
const apiRequest = vi.fn();
vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...actual, apiGet: (...a: unknown[]) => apiGet(...a), apiRequest: (...a: unknown[]) => apiRequest(...a) };
});

import { useBeatPlans } from "./use-beat-plans";

const config = { apiBaseUrl: "", authToken: "" };
const execs = { executives: [{ id: "u1", name: "Asha" }, { id: "u2", name: "Bala" }] };
const plan = { customers: [{ customerId: "c1", customerCode: "", legalName: "Acme", tradeName: null, phone: null, city: null, segment: null, weekday: 1, sequenceNo: 0 }] };

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
const setup = () => renderHook(() => useBeatPlans(config), { wrapper });

beforeEach(() => {
  vi.clearAllMocks();
  apiGet.mockImplementation((_c: unknown, path: string) => Promise.resolve(path.includes("executives") ? execs : plan));
  apiRequest.mockResolvedValue({});
});
afterEach(() => vi.restoreAllMocks());

describe("useBeatPlans", () => {
  it("loads executives, auto-selects the first, and loads their plan", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.executiveId).toBe("u1"));
    await waitFor(() => expect(result.current.customers.length).toBe(1));
    expect(apiGet).toHaveBeenCalledWith(config, "/beat-plans?executiveId=u1");
  });

  it("selectExecutive switches SE and re-raises the shimmer", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.switching).toBe(false));
    act(() => result.current.selectExecutive("u2"));
    expect(result.current.executiveId).toBe("u2");
    expect(result.current.switching).toBe(true);
  });

  it("reorder / remove / assign hit the right endpoints", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.executiveId).toBe("u1"));
    await act(async () => { await result.current.reorderMut.mutateAsync({ weekday: 1, customerIds: ["c1"] }); });
    expect(apiRequest).toHaveBeenCalledWith(config, "PUT", "/beat-plans/reorder", { executiveId: "u1", weekday: 1, customerIds: ["c1"] });
    await act(async () => { await result.current.removeMut.mutateAsync("c1"); });
    expect(apiRequest).toHaveBeenCalledWith(config, "DELETE", "/beat-plans/assign/c1");
    await act(async () => { await result.current.assignMut.mutateAsync({ customerId: "c1", weekday: 3 }); });
    expect(apiRequest).toHaveBeenCalledWith(config, "PUT", "/beat-plans/assign", { customerId: "c1", weekday: 3 });
  });
});
