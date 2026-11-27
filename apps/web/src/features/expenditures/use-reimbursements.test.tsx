import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn();
const apiRequest = vi.fn();
const invalidateQueries = vi.fn(() => Promise.resolve());
vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...actual, apiGet: (...a: unknown[]) => apiGet(...a), apiRequest: (...a: unknown[]) => apiRequest(...a) };
});
const state = vi.hoisted(() => ({ data: undefined as unknown }));
let cfg: { queryKey: unknown[]; queryFn: () => unknown };
vi.mock("@tanstack/react-query", () => ({
  useQuery: (c: typeof cfg) => { cfg = c; return { data: state.data, isLoading: false }; },
  useQueryClient: () => ({ invalidateQueries }),
}));

import { useReimbursements } from "./use-reimbursements";

const config = { apiBaseUrl: "", authToken: "" };
const owed = [
  { id: "p1", userId: "u1", amount: 450 },
  { id: "p2", userId: "u1", amount: 50 },
  { id: "p3", userId: "u2", amount: 100 },
];
beforeEach(() => { vi.clearAllMocks(); state.data = owed; apiGet.mockResolvedValue([]); apiRequest.mockResolvedValue({}); });
afterEach(() => vi.restoreAllMocks());

describe("useReimbursements", () => {
  it("queries owed payables and derives total + distinct people", () => {
    const { result } = renderHook(() => useReimbursements(config));
    expect(cfg.queryKey).toEqual(["reimbursements", "owed"]);
    cfg.queryFn();
    expect(apiGet).toHaveBeenCalledWith(config, "/reimbursements?status=owed");
    expect(result.current.total).toBe(600);
    expect(result.current.peopleCount).toBe(2);
  });

  it("marks a payable paid with a mode and refreshes", async () => {
    const { result } = renderHook(() => useReimbursements(config));
    await result.current.markPaid("p1", "upi");
    expect(apiRequest).toHaveBeenCalledWith(config, "POST", "/reimbursements/p1/pay", { paymentMode: "upi" });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["reimbursements"] });
  });

  it("marks paid with an empty body when no mode is given", async () => {
    const { result } = renderHook(() => useReimbursements(config));
    await result.current.markPaid("p1", null);
    expect(apiRequest).toHaveBeenCalledWith(config, "POST", "/reimbursements/p1/pay", {});
  });

  it("wraps a mark-paid failure", async () => {
    apiRequest.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useReimbursements(config));
    await expect(result.current.markPaid("p1", "cash")).rejects.toThrow("offline");
  });

  it("defaults to an empty queue before data resolves", () => {
    state.data = undefined;
    const { result } = renderHook(() => useReimbursements(config));
    expect(result.current.owed).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.peopleCount).toBe(0);
  });
});
