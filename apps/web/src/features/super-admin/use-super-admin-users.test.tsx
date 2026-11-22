import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const setFilter = vi.fn();
const urlState = {
  filters: { search: "", role: "MANAGER", status: "active" },
  sorting: [],
  setSorting: vi.fn(),
  pagination: { pageIndex: 0, pageSize: 8 },
  setPagination: vi.fn(),
  setFilter,
  hasFilters: true,
};
vi.mock("@/components/data-table/use-table-url-state", () => ({ useTableUrlState: () => urlState }));

const pagedArgs = vi.fn();
vi.mock("@/components/data-table/use-paged-table", () => ({
  usePagedTable: (opts: unknown) => {
    pagedArgs(opts);
    return { table: { id: "t" }, total: 3, pageCount: 1, pageSize: 8, isLoading: false, showSkeleton: false, error: null };
  },
}));

const invalidate = vi.fn();
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return { ...actual, useQueryClient: () => ({ invalidateQueries: invalidate }) };
});

import { useSuperAdminUsers } from "./use-super-admin-users";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const wrap = (qc: QueryClient) => ({ children }: { readonly children: ReactNode }) =>
  createElement(QueryClientProvider, { client: qc }, children);
const setup = () =>
  renderHook(() => useSuperAdminUsers(cfg, []), {
    wrapper: wrap(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
  });

afterEach(() => {
  setFilter.mockClear();
  invalidate.mockClear();
  pagedArgs.mockClear();
  vi.useRealTimers();
});

describe("useSuperAdminUsers", () => {
  it("passes the role/status filters and the paged endpoint through", () => {
    const { result } = setup();
    expect(result.current.filters).toEqual({ search: "", role: "MANAGER", status: "active" });
    expect(result.current.total).toBe(3);
    expect(pagedArgs).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/super-admin/users/paged", rowsKey: "users", queryKey: "super-admin-users" }),
    );
  });

  it("debounces the search box into the URL filter", () => {
    vi.useFakeTimers();
    const { result } = setup();
    act(() => result.current.setSearch("ravi"));
    act(() => vi.advanceTimersByTime(350));
    expect(setFilter).toHaveBeenCalledWith("search", "ravi");
  });

  it("does not re-set the filter when the box already matches the URL", () => {
    vi.useFakeTimers();
    const { result } = setup();
    act(() => result.current.setSearch("")); // already "" in the URL
    act(() => vi.advanceTimersByTime(350));
    expect(setFilter).not.toHaveBeenCalled();
  });

  it("refresh() invalidates the users query", () => {
    const { result } = setup();
    act(() => result.current.refresh());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["super-admin-users"] });
  });
});
