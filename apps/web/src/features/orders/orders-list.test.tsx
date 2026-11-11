import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const setCreateOpen = vi.fn();
const invalidate = vi.fn();
const acknowledge = vi.fn();

const v = {
  router: { push },
  state: { applied: { search: "", city: "", salesExecutiveId: "", dateFrom: "", dateTo: "" }, hasActiveFilters: false },
  filterFulfillment: "invoiced",
  setFilterFulfillment: vi.fn(),
  notif: { newCount: 2, highlightSince: null, acknowledge },
  canCreate: true,
  canInvoice: true,
  dialogs: { setCreateOpen, invalidate, actionError: null },
  columns: [{ id: "x" }],
  skeleton: [],
  paged: { table: {}, total: 5, pageCount: 1, pageSize: 8, isLoading: false, showSkeleton: false, error: null },
};

/* eslint-disable @typescript-eslint/no-explicit-any */
vi.mock("@/components/data-table/query-provider", () => ({ withQueryClient: (C: any) => C }));
vi.mock("@/features/shell/dashboard-shell", () => ({ DashboardShell: (p: any) => <div>{p.children}</div> }));
vi.mock("./use-orders-list", () => ({ useOrdersList: () => v }));
vi.mock("./orders-list-header", () => ({
  OrdersListHeader: (p: any) => (
    <div data-testid="header" data-total={p.total}>
      <button onClick={p.onNewOrder}>new</button>
    </div>
  ),
}));
vi.mock("./orders-list-controls", () => ({
  OrdersListControls: (p: any) => <button data-testid="controls" onClick={p.onLoadNew} />,
}));
vi.mock("./orders-list-table", () => ({
  OrdersListTable: (p: any) => <button data-testid="table" onClick={() => p.onRowClick({ id: "o9" })} />,
}));
vi.mock("./orders-create-edit-dialogs", () => ({
  OrdersCreateEditDialogs: (p: any) => <div data-testid="ce" data-cc={String(p.canCreate)} />,
}));
vi.mock("./orders-action-dialogs", () => ({
  OrdersActionDialogs: (p: any) => <div data-testid="ad" data-cc={String(p.canCreate)} />,
}));
/* eslint-enable @typescript-eslint/no-explicit-any */

import { OrdersList } from "./orders-list";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const props = {
  products: [],

  customers: [],
  salesExecutives: [],
  role: "SUPER_ADMIN" as const,
  actionConfig: cfg,
};

afterEach(() => vi.clearAllMocks());

describe("OrdersList", () => {
  it("distributes the total and role flags to the sub-components", () => {
    render(<OrdersList {...props} />);
    expect(screen.getByTestId("header")).toHaveAttribute("data-total", "5");
    expect(screen.getByTestId("ce")).toHaveAttribute("data-cc", "true");
    expect(screen.getByTestId("ad")).toHaveAttribute("data-cc", "true");
  });

  it("New Order opens the create dialog", () => {
    render(<OrdersList {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "new" }));
    expect(setCreateOpen).toHaveBeenCalledWith(true);
  });

  it("a row click navigates to the order detail", () => {
    render(<OrdersList {...props} />);
    fireEvent.click(screen.getByTestId("table"));
    expect(push).toHaveBeenCalledWith("/orders/o9");
  });

  it("loading new items acknowledges + invalidates", () => {
    render(<OrdersList {...props} />);
    fireEvent.click(screen.getByTestId("controls"));
    expect(acknowledge).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalled();
  });
});
