import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */
vi.mock("@/components/page-header", () => ({
  PageHeader: (p: any) => (
    <div>
      <div data-testid="subtitle">{p.subtitle}</div>
      <div data-testid="action">{p.action}</div>
    </div>
  ),
}));
vi.mock("./orders-download", () => ({
  OrdersDownload: (p: any) => (
    <div data-testid="download" data-fulfillment={p.defaultFulfillment} data-search={p.filters.search} />
  ),
}));
/* eslint-enable @typescript-eslint/no-explicit-any */

import { OrdersListHeader } from "./orders-list-header";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const base = {
  canCreate: true,
  onNewOrder: vi.fn(),
  total: 3,
  isLoading: false,
  actionConfig: cfg,
  filterFulfillment: "invoiced",
  downloadFilters: { search: "abc", city: "", salesExecutiveId: "", dateFrom: "", dateTo: "" },
};

afterEach(() => vi.restoreAllMocks());

describe("OrdersListHeader", () => {
  it("shows a loading subtitle while loading", () => {
    render(<OrdersListHeader {...base} isLoading />);
    expect(screen.getByTestId("subtitle")).toHaveTextContent("Loading…");
  });

  it("pluralises the order count", () => {
    const { rerender } = render(<OrdersListHeader {...base} total={1} />);
    expect(screen.getByTestId("subtitle")).toHaveTextContent("1 order in your organisation");
    rerender(<OrdersListHeader {...base} total={3} />);
    expect(screen.getByTestId("subtitle")).toHaveTextContent("3 orders in your organisation");
  });

  it("offers New Order only when allowed, and fires the handler", () => {
    const onNewOrder = vi.fn();
    const { rerender } = render(<OrdersListHeader {...base} onNewOrder={onNewOrder} />);
    fireEvent.click(screen.getByRole("button", { name: "+ New Order" }));
    expect(onNewOrder).toHaveBeenCalled();
    rerender(<OrdersListHeader {...base} canCreate={false} />);
    expect(screen.queryByRole("button", { name: "+ New Order" })).not.toBeInTheDocument();
  });

  it("passes the fulfillment + filters through to Download", () => {
    render(<OrdersListHeader {...base} />);
    const dl = screen.getByTestId("download");
    expect(dl).toHaveAttribute("data-fulfillment", "invoiced");
    expect(dl).toHaveAttribute("data-search", "abc");
  });
});
