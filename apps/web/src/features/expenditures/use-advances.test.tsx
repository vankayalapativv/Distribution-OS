import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn();
const apiRequest = vi.fn();
const invalidateQueries = vi.fn(() => Promise.resolve());
vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...actual, apiGet: (...a: unknown[]) => apiGet(...a), apiRequest: (...a: unknown[]) => apiRequest(...a) };
});
const state = vi.hoisted(() => ({ requests: [{ id: "a1" }] as unknown, balances: [{ outstanding: 8000 }, { outstanding: 2000 }] as unknown }));
const cfgs: { queryKey: unknown[]; queryFn: () => unknown }[] = [];
vi.mock("@tanstack/react-query", () => ({
  useQuery: (c: { queryKey: unknown[]; queryFn: () => unknown }) => {
    cfgs.push(c);
    const key = (c.queryKey as string[])[0];
    return { data: key === "advances" ? state.requests : state.balances, isLoading: false };
  },
  useQueryClient: () => ({ invalidateQueries }),
}));

import { useAdvances } from "./use-advances";

const config = { apiBaseUrl: "", authToken: "" };
beforeEach(() => { vi.clearAllMocks(); cfgs.length = 0; state.requests = [{ id: "a1" }]; state.balances = [{ outstanding: 8000 }, { outstanding: 2000 }]; apiGet.mockResolvedValue([]); apiRequest.mockResolvedValue({}); });
afterEach(() => vi.restoreAllMocks());

describe("useAdvances", () => {
  it("queries requests + balances and derives the outstanding total", () => {
    const { result } = renderHook(() => useAdvances(config));
    cfgs.forEach((c) => c.queryFn());
    expect(apiGet).toHaveBeenCalledWith(config, "/advances?status=requested");
    expect(apiGet).toHaveBeenCalledWith(config, "/advances/balances");
    expect(result.current.requests).toHaveLength(1);
    expect(result.current.outstandingTotal).toBe(10000);
  });

  it("approves with a plan and refreshes", async () => {
    const { result } = renderHook(() => useAdvances(config));
    await result.current.approve("a1", { recoveryPlan: "full_next", installmentAmount: null });
    expect(apiRequest).toHaveBeenCalledWith(config, "POST", "/advances/a1/approve", { recoveryPlan: "full_next", installmentAmount: null });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["advances"] });
  });

  it("rejects and records, and wraps failures", async () => {
    const { result } = renderHook(() => useAdvances(config));
    await result.current.reject("a1", "no budget");
    expect(apiRequest).toHaveBeenCalledWith(config, "POST", "/advances/a1/reject", { reason: "no budget" });
    await result.current.record({ userId: "u1", amount: 5000, reason: null, recoveryPlan: "full_next", installmentAmount: null });
    expect(apiRequest).toHaveBeenCalledWith(config, "POST", "/advances/record", { userId: "u1", amount: 5000, reason: null, recoveryPlan: "full_next", installmentAmount: null });
    apiRequest.mockRejectedValueOnce(new Error("boom"));
    await expect(result.current.approve("a1", { recoveryPlan: "full_next", installmentAmount: null })).rejects.toThrow("boom");
  });

  it("defaults to empty lists before data resolves", () => {
    state.requests = undefined; state.balances = undefined;
    const { result } = renderHook(() => useAdvances(config));
    expect(result.current.requests).toEqual([]);
    expect(result.current.balances).toEqual([]);
    expect(result.current.outstandingTotal).toBe(0);
  });
});
