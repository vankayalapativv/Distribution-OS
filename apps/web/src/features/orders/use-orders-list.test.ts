import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const setFilter = vi.fn();
const buildOrdersColumns = vi.fn((..._a: unknown[]) => ({ columns: [{ id: "x" }], skeleton: [] }));
const usePagedTable = vi.fn((..._a: unknown[]) => ({ total: 5, table: {}, showSkeleton: false }));
const openEdit = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/data-table/use-paged-table", () => ({ usePagedTable: (...a: unknown[]) => usePagedTable(...a) }));
vi.mock("@/features/shell/use-section-notifications", () => ({
  useSectionNotifications: () => ({ newCount: 2, highlightSince: null, acknowledge: vi.fn() }),
}));
vi.mock("./orders-list-columns", () => ({ buildOrdersColumns: (...a: unknown[]) => buildOrdersColumns(...a) }));
vi.mock("./use-orders-list-state", () => ({
  ORDER_SORT: [],
  useOrdersListState: () => ({
    applied: { fulfillment: "invoiced" },
    url: { setFilter, sorting: [], setSorting: vi.fn(), pagination: {}, setPagination: vi.fn() },
  }),
}));
vi.mock("./use-orders-dialogs", () => ({
  useOrdersDialogs: () => ({ setCanceling: vi.fn(), openEdit }),
}));

import { useOrdersList } from "./use-orders-list";

const cfg = { apiBaseUrl: "x", authToken: "t" };

afterEach(() => {
  buildOrdersColumns.mockClear();
  setFilter.mockReset();
});

describe("useOrdersList role flags", () => {
  it("SUPER_ADMIN can create and invoice", () => {
    const { result } = renderHook(() => useOrdersList([], "SUPER_ADMIN", cfg));
    expect(result.current.canCreate).toBe(true);
    expect(result.current.canInvoice).toBe(true);
  });
  it("MANAGER can create but not invoice", () => {
    const { result } = renderHook(() => useOrdersList([], "MANAGER", cfg));
    expect(result.current.canCreate).toBe(true);
    expect(result.current.canInvoice).toBe(false);
  });
  it("ACCOUNTANT can invoice but not create", () => {
    const { result } = renderHook(() => useOrdersList([], "ACCOUNTANT", cfg));
    expect(result.current.canCreate).toBe(false);
    expect(result.current.canInvoice).toBe(true);
  });
});

describe("useOrdersList wiring", () => {
  it("builds columns with the derived flags + dialog handlers", () => {
    renderHook(() => useOrdersList([], "SUPER_ADMIN", cfg));
    const opts = buildOrdersColumns.mock.calls[0][0] as Record<string, unknown>;
    expect(opts).toMatchObject({ filterFulfillment: "invoiced", canCreate: true, canInvoice: true, showActions: true });
    (opts.onEdit as (o: unknown) => void)({ id: "o1" });
    expect(openEdit).toHaveBeenCalledWith({ id: "o1" });
    (opts.onGenerate as (o: unknown) => void)({ id: "o1" });
    expect(push).toHaveBeenCalledWith("/invoices/new?orderId=o1");
  });

  it("setFilterFulfillment writes the fulfillment URL filter", () => {
    const { result } = renderHook(() => useOrdersList([], "SUPER_ADMIN", cfg));
    act(() => result.current.setFilterFulfillment("delivered"));
    expect(setFilter).toHaveBeenCalledWith("fulfillment", "delivered");
  });

  it("returns the paged-table result + notifications", () => {
    const { result } = renderHook(() => useOrdersList([], "MANAGER", cfg));
    expect(result.current.paged.total).toBe(5);
    expect(result.current.notif.newCount).toBe(2);
    expect(result.current.columns).toHaveLength(1);
  });
});
