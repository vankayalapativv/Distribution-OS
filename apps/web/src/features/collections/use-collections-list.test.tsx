import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const setFilter = vi.fn();
const url = {
  filters: { status: "pending", search: "", customerId: "cu1", collectedBy: "u1", date: "2026-09-14" },
  setFilter, setSorting: vi.fn(), setPagination: vi.fn(), sorting: [], pagination: {}, hasFilters: true,
};
vi.mock("@/components/data-table/use-table-url-state", () => ({ useTableUrlState: () => url }));
vi.mock("@/components/data-table/use-paged-table", () => ({
  usePagedTable: () => ({ table: {}, total: 5, pageCount: 1, pageSize: 8, isLoading: false, showSkeleton: false, error: null }),
}));
vi.mock("@/features/shell/use-section-notifications", () => ({
  useSectionNotifications: () => ({ newCount: 2, highlightSince: "2026-09-01", acknowledge: vi.fn() }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { total: 3 } }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

import { useCollectionsList } from "./use-collections-list";

const config = { apiBaseUrl: "", authToken: "" };
const customers = [{ id: "cu1", legalName: "Sri Laxmi" }] as never;

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); setFilter.mockReset(); });

describe("useCollectionsList", () => {
  it("derives status, customer name, date and the pending count", () => {
    const { result } = renderHook(() => useCollectionsList(config, customers));
    expect(result.current.statusFilter).toBe("pending");
    expect(result.current.customerName).toBe("Sri Laxmi");
    expect(result.current.collectionDate?.getFullYear()).toBe(2026);
    expect(result.current.pendingCount).toBe(3);
    expect(result.current.total).toBe(5);
  });

  it("debounces the search box into the URL filter after 350ms", () => {
    const { result } = renderHook(() => useCollectionsList(config, customers));
    act(() => result.current.setSearch("COL-1"));
    expect(setFilter).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(350));
    expect(setFilter).toHaveBeenCalledWith("search", "COL-1");
  });
});
