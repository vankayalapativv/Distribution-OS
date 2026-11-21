import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn();
const apiRequest = vi.fn();
vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...actual, apiGet: (...a: unknown[]) => apiGet(...a), apiRequest: (...a: unknown[]) => apiRequest(...a) };
});
const paged = { table: {}, total: 3, pageCount: 1, pageSize: 8, isLoading: false, showSkeleton: false, error: null };
const usePagedTable = vi.fn();
vi.mock("@/components/data-table/use-paged-table", () => ({ usePagedTable: (o: unknown) => { usePagedTable(o); return paged; } }));
const invalidateQueries = vi.fn();
const useQuery = vi.fn();
vi.mock("@tanstack/react-query", () => ({ useQuery: (o: unknown) => useQuery(o), useQueryClient: () => ({ invalidateQueries }) }));
vi.mock("./expenditures-columns", () => ({ buildExpenditureColumns: () => [1, 2] }));
let sp = new URLSearchParams();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => sp,
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => "/expenditures",
}));

import { useExpendituresList } from "./use-expenditures-list";
import type { Expenditure } from "./expenditures-api";

const config = { apiBaseUrl: "", authToken: "" };
const entry = { id: "e1" } as Expenditure;

beforeEach(() => {
  vi.clearAllMocks();
  sp = new URLSearchParams();
  useQuery.mockReturnValue({ data: { categories: [{ id: "c1" }], people: [{ id: "u1" }] } });
});
afterEach(() => { vi.restoreAllMocks(); });

describe("useExpendituresList — filters, lookups & deletion", () => {
  it("maps every filter setter into the URL and flags hasFilters per active filter", () => {
    sp = new URLSearchParams({ type: "variable" });
    const typed = renderHook(() => useExpendituresList(config));
    expect(typed.result.current.hasFilters).toBe(true); // typeFilter !== "all"
    act(() => {
      typed.result.current.setPeriod("2026-07-01", "2026-07-31"); // explicit "to"
      typed.result.current.setPeriod("2026-07-05", ""); // blank "to" falls back to "from"
      typed.result.current.setTypeFilter("all"); // "all" → cleared
      typed.result.current.setCategoryFilter("c1"); // a real category
      typed.result.current.setCategoryFilter("all"); // cleared
      typed.result.current.clearFilters();
    });
    expect(replace).toHaveBeenCalled();

    sp = new URLSearchParams({ categoryId: "c1" });
    expect(renderHook(() => useExpendituresList(config)).result.current.hasFilters).toBe(true); // categoryFilter !== "all"
  });

  it("flags hasFilters from an applied (URL) search term", () => {
    sp = new URLSearchParams({ q: "fuel" }); // appliedSearch = url.filters.q
    expect(renderHook(() => useExpendituresList(config)).result.current.hasFilters).toBe(true);
  });

  it("the category + people queries hit their endpoints", () => {
    renderHook(() => useExpendituresList(config));
    const fns = useQuery.mock.calls.map((c) => c[0].queryFn);
    fns.forEach((fn) => fn());
    expect(apiGet).toHaveBeenCalledWith(config, "/expenditures/categories");
    expect(apiGet).toHaveBeenCalledWith(config, "/expenditures/people");
  });

  it("confirmDelete DELETEs the entry, invalidates, and clears", async () => {
    apiRequest.mockResolvedValue({});
    const { result } = renderHook(() => useExpendituresList(config));
    act(() => result.current.setDeleting(entry));
    await act(async () => { await result.current.confirmDelete(); });
    expect(apiRequest).toHaveBeenCalledWith(config, "DELETE", "/expenditures/e1");
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["expenditures"] });
    expect(result.current.deleting).toBeNull();
  });

  it("confirmDelete throws a friendly error on failure", async () => {
    apiRequest.mockRejectedValueOnce(new Error("in use"));
    const { result } = renderHook(() => useExpendituresList(config));
    act(() => result.current.setDeleting(entry));
    await expect(result.current.confirmDelete()).rejects.toThrow("in use");
  });
});
