import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn();
const apiRequest = vi.fn();
const invalidateQueries = vi.fn(() => Promise.resolve());
vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...actual, apiGet: (...a: unknown[]) => apiGet(...a), apiRequest: (...a: unknown[]) => apiRequest(...a) };
});
const state = vi.hoisted(() => ({ rows: [{ userId: "u1" }] as unknown, staff: [{ id: "u1", name: "Priya" }] as unknown }));
const cfgs: { queryKey: unknown[]; queryFn: () => unknown }[] = [];
vi.mock("@tanstack/react-query", () => ({
  useQuery: (c: { queryKey: unknown[]; queryFn: () => unknown }) => {
    cfgs.push(c);
    const key = (c.queryKey as string[])[0];
    return { data: key === "salaries" ? state.rows : state.staff, isLoading: false };
  },
  useQueryClient: () => ({ invalidateQueries }),
}));

import { useSalary } from "./use-salary";

const config = { apiBaseUrl: "", authToken: "" };
beforeEach(() => { vi.clearAllMocks(); cfgs.length = 0; state.rows = [{ userId: "u1" }]; state.staff = [{ id: "u1", name: "Priya" }]; apiGet.mockResolvedValue([]); apiRequest.mockResolvedValue({}); });
afterEach(() => vi.restoreAllMocks());

describe("useSalary", () => {
  it("queries the salary table + staff", () => {
    const { result } = renderHook(() => useSalary(config));
    cfgs.forEach((c) => c.queryFn());
    expect(apiGet).toHaveBeenCalledWith(config, "/salary");
    expect(apiGet).toHaveBeenCalledWith(config, "/salary/staff");
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.staff).toHaveLength(1);
  });

  it("sets a salary and refreshes", async () => {
    const { result } = renderHook(() => useSalary(config));
    await result.current.setSalary("u1", 20000, null);
    expect(apiRequest).toHaveBeenCalledWith(config, "POST", "/salary/set", { userId: "u1", amount: 20000, effectiveFrom: null });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["salaries"] });
  });

  it("pays a salary and wraps failures", async () => {
    const { result } = renderHook(() => useSalary(config));
    await result.current.paySalary("u1", "2026-11-01", "upi");
    expect(apiRequest).toHaveBeenCalledWith(config, "POST", "/salary/pay", { userId: "u1", periodMonth: "2026-11-01", paymentMode: "upi" });
    apiRequest.mockRejectedValueOnce(new Error("boom"));
    await expect(result.current.setSalary("u1", 1, null)).rejects.toThrow("boom");
  });

  it("defaults to empty lists before data resolves", () => {
    state.rows = undefined; state.staff = undefined;
    const { result } = renderHook(() => useSalary(config));
    expect(result.current.rows).toEqual([]);
    expect(result.current.staff).toEqual([]);
  });
});
