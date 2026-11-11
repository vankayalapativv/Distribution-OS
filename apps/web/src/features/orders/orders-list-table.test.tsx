import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */
let captured: any = null;
vi.mock("@/components/data-table/data-table", () => ({
  DataTable: (p: any) => {
    captured = p;
    return (
      <div data-testid="dt">
        <div data-testid="empty">{p.empty}</div>
        <button onClick={() => p.onRowClick({ id: "o1" })}>row</button>
      </div>
    );
  },
}));
/* eslint-enable @typescript-eslint/no-explicit-any */

import { OrdersListTable } from "./orders-list-table";
import type { Order } from "./orders-api";

const base = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: {} as any,
  columnCount: 8,
  skeleton: [],
  showSkeleton: false,
  pageSize: 8,
  pageCount: 1,
  highlightSince: "2026-03-01" as string | null,
  hasActiveFilters: false,
  canCreate: true,
  onNewOrder: vi.fn(),
  onRowClick: vi.fn(),
};
const row = (over: Partial<Order>): Order => ({ createdAt: "2026-01-01", fulfillmentStatus: "delivered", ...over }) as Order;

afterEach(() => {
  captured = null;
  vi.restoreAllMocks();
});

describe("OrdersListTable", () => {
  it("highlights rows newer than the last-seen mark, else washes by status", () => {
    render(<OrdersListTable {...base} />);
    expect(captured.rowClassName(row({ createdAt: "2026-05-01" }))).toBe("bg-blue-50/60");
    expect(captured.rowClassName(row({ createdAt: "2026-01-01", fulfillmentStatus: "delivered" }))).toBe("bg-green-50/50");
  });

  it("washes by status (defaulting to ordered) when there is no highlight mark", () => {
    render(<OrdersListTable {...base} highlightSince={null} />);
    expect(captured.rowClassName(row({ fulfillmentStatus: undefined as never }))).toBe("bg-slate-50/70");
  });

  it("shows the filtered empty message when filters are active", () => {
    render(<OrdersListTable {...base} hasActiveFilters />);
    expect(screen.getByTestId("empty")).toHaveTextContent("No orders match your filters.");
  });

  it("offers a create shortcut in the empty state (only when allowed)", () => {
    const onNewOrder = vi.fn();
    const { rerender } = render(<OrdersListTable {...base} onNewOrder={onNewOrder} />);
    fireEvent.click(screen.getByRole("button", { name: "Create your first order" }));
    expect(onNewOrder).toHaveBeenCalled();
    rerender(<OrdersListTable {...base} canCreate={false} />);
    expect(screen.queryByRole("button", { name: "Create your first order" })).not.toBeInTheDocument();
  });

  it("forwards row clicks", () => {
    const onRowClick = vi.fn();
    render(<OrdersListTable {...base} onRowClick={onRowClick} />);
    fireEvent.click(screen.getByRole("button", { name: "row" }));
    expect(onRowClick).toHaveBeenCalledWith({ id: "o1" });
  });
});
