import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomerOption } from "@/features/customers/customer-search-select";

const setFilter = vi.fn();
const setFilters = vi.fn();
const clearFilters = vi.fn();
let filters: Record<string, string> = {};

vi.mock("@/components/data-table/use-table-url-state", () => ({
  useTableUrlState: () => ({
    filters,
    setFilter,
    setFilters,
    clearFilters,
    sorting: [],
    setSorting: vi.fn(),
    pagination: { pageIndex: 0, pageSize: 8 },
    setPagination: vi.fn(),
  }),
}));

import { useOrdersListState } from "./use-orders-list-state";

const customers = [
  { id: "c1", legalName: "Raj Motors", addressCity: "Bengaluru" },
  { id: "c2", legalName: "AB Traders", addressCity: null },
  { id: "c3", legalName: "Zeta", addressCity: "Ambala" },
] as CustomerOption[];

beforeEach(() => {
  filters = {};
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  setFilter.mockReset();
  setFilters.mockReset();
  clearFilters.mockReset();
});

describe("useOrdersListState", () => {
  it("derives distinct, sorted cities and drops blanks", () => {
    const { result } = renderHook(() => useOrdersListState(customers));
    expect(result.current.cities).toEqual(["Ambala", "Bengaluru"]);
  });

  it("resolves the customer chip name (found, missing, and none)", () => {
    filters = { customerId: "c1" };
    expect(renderHook(() => useOrdersListState(customers)).result.current.appliedCustomerName).toBe("Raj Motors");
    filters = { customerId: "ghost" };
    expect(renderHook(() => useOrdersListState(customers)).result.current.appliedCustomerName).toBe("Customer");
    filters = {};
    expect(renderHook(() => useOrdersListState(customers)).result.current.appliedCustomerName).toBe("");
  });

  it("builds a dateRange only when dateFrom is set", () => {
    filters = { dateFrom: "2026-03-01", dateTo: "2026-03-05" };
    const r1 = renderHook(() => useOrdersListState(customers)).result.current.dateRange;
    expect(r1?.from?.getDate()).toBe(1);
    expect(r1?.to?.getDate()).toBe(5);
    filters = { dateFrom: "2026-03-01" };
    expect(renderHook(() => useOrdersListState(customers)).result.current.dateRange?.to).toBeUndefined();
    filters = {};
    expect(renderHook(() => useOrdersListState(customers)).result.current.dateRange).toBeUndefined();
  });

  it("flags active filters when any is set", () => {
    filters = { salesExecutiveId: "se1" };
    expect(renderHook(() => useOrdersListState(customers)).result.current.hasActiveFilters).toBe(true);
    filters = {};
    expect(renderHook(() => useOrdersListState(customers)).result.current.hasActiveFilters).toBe(false);
  });

  it("debounces the search box into the URL (trimmed) and skips a no-op", () => {
    const { result } = renderHook(() => useOrdersListState(customers));
    act(() => result.current.setSearch("  widget  "));
    act(() => vi.advanceTimersByTime(300));
    expect(setFilter).toHaveBeenCalledWith("search", "widget");
  });

  it("does not re-write the URL when the debounced search already matches", () => {
    filters = { search: "widget" };
    renderHook(() => useOrdersListState(customers));
    act(() => vi.advanceTimersByTime(300));
    expect(setFilter).not.toHaveBeenCalled();
  });

  it("setDateRange writes formatted from/to (blank when cleared)", () => {
    const { result } = renderHook(() => useOrdersListState(customers));
    act(() => result.current.setDateRange({ from: new Date(2026, 2, 1), to: new Date(2026, 2, 5) }));
    expect(setFilters).toHaveBeenCalledWith({ dateFrom: "2026-03-01", dateTo: "2026-03-05" });
    act(() => result.current.setDateRange(undefined));
    expect(setFilters).toHaveBeenLastCalledWith({ dateFrom: "", dateTo: "" });
  });

  it("clearFilters resets the search box and clears the URL", () => {
    const { result } = renderHook(() => useOrdersListState(customers));
    act(() => result.current.setSearch("x"));
    act(() => result.current.clearFilters());
    expect(clearFilters).toHaveBeenCalled();
    expect(result.current.search).toBe("");
  });
});
