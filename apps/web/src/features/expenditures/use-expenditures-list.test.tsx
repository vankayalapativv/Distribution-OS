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
  vi.useFakeTimers();
  useQuery.mockReturnValue({ data: { categories: [{ id: "c1" }], people: [{ id: "u1" }] } });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("useExpendituresList", () => {
  it("defaults to the current month and the type/category = all filters", () => {
    const { result } = renderHook(() => useExpendituresList(config));
    expect(result.current.from).toMatch(/-01$/);
    expect(result.current.typeFilter).toBe("all");
    expect(result.current.hasFilters).toBe(false);
    const cfg = usePagedTable.mock.calls.at(-1)![0] as { filters: Record<string, string> };
    expect(cfg.filters).toMatchObject({ type: "", categoryId: "", q: "" });
  });

  it("debounces search and maps the type filter into the URL", () => {
    const { result } = renderHook(() => useExpendituresList(config));
    act(() => { result.current.setTypeFilter("variable"); });
    expect(replace).toHaveBeenCalledWith("/expenditures?type=variable", { scroll: false });
    act(() => { result.current.setSearch("  fuel "); });
    act(() => vi.advanceTimersByTime(350));
    expect(replace).toHaveBeenCalledWith("/expenditures?q=fuel", { scroll: false });
  });

  it("openNew clears editing + opens the form; handleEdit targets a row", () => {
    const { result } = renderHook(() => useExpendituresList(config));
    act(() => result.current.handleEdit(entry));
    expect(result.current.editing).toBe(entry);
    expect(result.current.formOpen).toBe(true);
    act(() => result.current.openNew());
    expect(result.current.editing).toBeNull();
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

  it("the category + people queries hit their endpoints", () => {
    renderHook(() => useExpendituresList(config));
    const fns = useQuery.mock.calls.map((c) => c[0].queryFn);
    fns.forEach((fn) => fn());
    expect(apiGet).toHaveBeenCalledWith(config, "/expenditures/categories");
    expect(apiGet).toHaveBeenCalledWith(config, "/expenditures/people");
  });

  it("confirmDelete throws a friendly error on failure", async () => {
    apiRequest.mockRejectedValueOnce(new Error("in use"));
    const { result } = renderHook(() => useExpendituresList(config));
    act(() => result.current.setDeleting(entry));
    await expect(result.current.confirmDelete()).rejects.toThrow("in use");
  });
});
