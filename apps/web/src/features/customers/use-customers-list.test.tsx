import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const setFilter = vi.fn();
const urlState = {
  filters: { search: "", city: "Hyd", salesExecutiveId: "u1", dues: "owes" },
  sorting: [],
  setSorting: vi.fn(),
  pagination: { pageIndex: 0, pageSize: 8 },
  setPagination: vi.fn(),
  setFilter,
  hasFilters: true,
};
vi.mock("@/components/data-table/use-table-url-state", () => ({ useTableUrlState: () => urlState }));
vi.mock("@/components/data-table/use-paged-table", () => ({
  usePagedTable: () => ({ table: { id: "t" }, total: 5, pageCount: 1, pageSize: 8, isLoading: false, showSkeleton: false, error: null }),
}));
vi.mock("./use-customers-download", () => ({
  useCustomersDownload: () => ({ downloading: false, downloadPdf: vi.fn() }),
}));
const apiGet = vi.fn(async (..._a: unknown[]) => ({ cities: ["Hyd"], salesExecutives: [{ id: "u1", name: "Ravi" }] }));
vi.mock("@/lib/api-client", () => ({ apiGet: (...a: unknown[]) => apiGet(...a) }));

import { useCustomersList } from "./use-customers-list";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const wrap = (qc: QueryClient) => ({ children }: { readonly children: ReactNode }) =>
  createElement(QueryClientProvider, { client: qc }, children);
const setup = () =>
  renderHook(() => useCustomersList(cfg), {
    wrapper: wrap(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
  });

afterEach(() => {
  setFilter.mockClear();
  vi.useRealTimers();
});

describe("useCustomersList", () => {
  it("exposes filters, options and the paged table", async () => {
    const { result } = setup();
    expect(result.current.filters.city).toBe("Hyd");
    expect(result.current.total).toBe(5);
    await waitFor(() => expect(result.current.cities).toEqual(["Hyd"]));
    expect(result.current.salesExecutives).toEqual([{ id: "u1", name: "Ravi" }]);
  });

  it("debounces the search box into the URL filter", () => {
    vi.useFakeTimers();
    const { result } = setup();
    act(() => result.current.setSearch("raj"));
    act(() => vi.advanceTimersByTime(350));
    expect(setFilter).toHaveBeenCalledWith("search", "raj");
  });

  it("does not re-set the filter when the box already matches the URL", () => {
    vi.useFakeTimers();
    setup(); // search seeded from url.filters.search ("") — already equal
    act(() => vi.advanceTimersByTime(350));
    expect(setFilter).not.toHaveBeenCalled();
  });
});
