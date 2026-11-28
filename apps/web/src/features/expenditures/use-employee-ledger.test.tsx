import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn();
vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...actual, apiGet: (...a: unknown[]) => apiGet(...a) };
});
const state = vi.hoisted(() => ({ data: undefined as unknown, isLoading: false }));
let cfg: { queryKey: unknown[]; queryFn: () => unknown; enabled: boolean } | null = null;
vi.mock("@tanstack/react-query", () => ({
  useQuery: (c: { queryKey: unknown[]; queryFn: () => unknown; enabled: boolean }) => { cfg = c; return { data: state.data, isLoading: state.isLoading }; },
}));

import { useEmployeeLedger } from "./use-employee-ledger";

const config = { apiBaseUrl: "", authToken: "" };
beforeEach(() => { vi.clearAllMocks(); cfg = null; state.data = undefined; state.isLoading = false; apiGet.mockResolvedValue({}); });
afterEach(() => vi.restoreAllMocks());

describe("useEmployeeLedger", () => {
  it("is disabled until a person is picked", () => {
    const { result } = renderHook(() => useEmployeeLedger(config, null));
    expect(cfg!.enabled).toBe(false);
    expect(result.current.ledger).toBeNull();
    expect(result.current.isLoading).toBe(false); // never loading without a person
  });

  it("fetches the ledger for the picked person", () => {
    state.isLoading = true;
    const { result } = renderHook(() => useEmployeeLedger(config, "u1"));
    expect(cfg!.enabled).toBe(true);
    cfg!.queryFn();
    expect(apiGet).toHaveBeenCalledWith(config, "/expenditures/ledger?userId=u1");
    expect(result.current.isLoading).toBe(true);
  });

  it("surfaces the loaded ledger", () => {
    state.data = { entries: [], summary: {}, salaryIncluded: false };
    const { result } = renderHook(() => useEmployeeLedger(config, "u1"));
    expect(result.current.ledger).toEqual({ entries: [], summary: {}, salaryIncluded: false });
  });
});
