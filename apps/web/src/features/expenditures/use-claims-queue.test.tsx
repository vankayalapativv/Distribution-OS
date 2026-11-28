import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn();
const apiRequest = vi.fn();
const invalidateQueries = vi.fn(() => Promise.resolve());
vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...actual, apiGet: (...a: unknown[]) => apiGet(...a), apiRequest: (...a: unknown[]) => apiRequest(...a) };
});
const state = vi.hoisted(() => ({ data: [{ id: "c1" }] as unknown, isLoading: false }));
let queryCfg: { queryKey: unknown[]; queryFn: () => unknown };
vi.mock("@tanstack/react-query", () => ({
  useQuery: (c: typeof queryCfg) => { queryCfg = c; return { data: state.data, isLoading: state.isLoading }; },
  useQueryClient: () => ({ invalidateQueries }),
}));

import { useClaimsQueue } from "./use-claims-queue";

const config = { apiBaseUrl: "", authToken: "" };
beforeEach(() => { vi.clearAllMocks(); state.data = [{ id: "c1" }]; state.isLoading = false; apiGet.mockResolvedValue([]); apiRequest.mockResolvedValue({}); });
afterEach(() => vi.restoreAllMocks());

describe("useClaimsQueue", () => {
  it("queries submitted claims and exposes them", () => {
    const { result } = renderHook(() => useClaimsQueue(config));
    expect(queryCfg.queryKey).toEqual(["expense-claims", "submitted"]);
    queryCfg.queryFn();
    expect(apiGet).toHaveBeenCalledWith(config, "/expense-claims?status=submitted");
    expect(result.current.claims).toEqual([{ id: "c1" }]);
    expect(result.current.isLoading).toBe(false);
  });

  it("approves + reimburses at a reduced amount and refreshes the ledger", async () => {
    const { result } = renderHook(() => useClaimsQueue(config));
    await result.current.approve("x1", 300, "cash");
    expect(apiRequest).toHaveBeenCalledWith(config, "POST", "/expense-claims/x1/approve", { paymentMode: "cash", approvedAmount: 300 });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["expense-claims"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["expenditures"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["expenditure-summary"] });
  });

  it("always sends the approved amount with the mode", async () => {
    const { result } = renderHook(() => useClaimsQueue(config));
    await result.current.approve("x1", 500, "upi");
    expect(apiRequest).toHaveBeenCalledWith(config, "POST", "/expense-claims/x1/approve", { paymentMode: "upi", approvedAmount: 500 });
  });

  it("wraps an approve failure", async () => {
    apiRequest.mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() => useClaimsQueue(config));
    await expect(result.current.approve("x1", 100, "cash")).rejects.toThrow("boom");
  });

  it("rejects with a reason and refreshes", async () => {
    const { result } = renderHook(() => useClaimsQueue(config));
    await result.current.reject("x1", "blurry");
    expect(apiRequest).toHaveBeenCalledWith(config, "POST", "/expense-claims/x1/reject", { reason: "blurry" });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["expense-claims"] });
  });

  it("wraps a reject failure", async () => {
    apiRequest.mockRejectedValueOnce(new Error("nope"));
    const { result } = renderHook(() => useClaimsQueue(config));
    await expect(result.current.reject("x1", "r")).rejects.toThrow("nope");
  });

  it("defaults to an empty list before the query resolves", () => {
    state.data = undefined;
    const { result } = renderHook(() => useClaimsQueue(config));
    expect(result.current.claims).toEqual([]);
  });
});
