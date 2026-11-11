import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */
vi.mock("./orders-fulfillment-summary", () => ({
  OrdersFulfillmentSummary: (p: any) => (
    <button data-testid="summary" data-active={p.active} onClick={() => p.onSelect("invoiced")} />
  ),
}));
vi.mock("./orders-filters", () => ({
  OrdersFilters: (p: any) => (
    <div data-testid="filters" data-search={p.search}>
      <button onClick={() => p.onCityChange("BLR")}>city</button>
      <button onClick={() => p.onSalesExecChange("se1")}>se</button>
      <button onClick={p.onClear}>clear</button>
    </div>
  ),
}));
vi.mock("@/features/shell/new-items-banner", () => ({
  NewItemsBanner: (p: any) => <button data-testid="banner" data-count={p.count} onClick={p.onLoad} />,
}));
/* eslint-enable @typescript-eslint/no-explicit-any */

import { OrdersListControls } from "./orders-list-controls";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const setFilter = vi.fn();
const clearFilters = vi.fn();

const makeState = (applied: Record<string, string>) =>
  ({
    applied,
    search: "abc",
    setSearch: vi.fn(),
    cities: ["Ambala"],
    appliedCustomerName: "Raj Motors",
    dateRange: undefined,
    setDateRange: vi.fn(),
    clearFilters,
    hasActiveFilters: true,
    url: { setFilter },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

const setup = (over: { applied?: Record<string, string>; errorText?: string | null } = {}) => {
  const props = {
    state: makeState(over.applied ?? {}),
    salesExecutives: [],
    actionConfig: cfg,
    filterFulfillment: "invoiced",
    setFilterFulfillment: vi.fn(),
    errorText: over.errorText ?? null,
    newCount: 4,
    onLoadNew: vi.fn(),
  };
  render(<OrdersListControls {...props} />);
  return props;
};

afterEach(() => {
  vi.restoreAllMocks();
  setFilter.mockReset();
  clearFilters.mockReset();
});

describe("OrdersListControls", () => {
  it("passes the active fulfillment to the summary and selects through it", () => {
    const p = setup();
    expect(screen.getByTestId("summary")).toHaveAttribute("data-active", "invoiced");
    fireEvent.click(screen.getByTestId("summary"));
    expect(p.setFilterFulfillment).toHaveBeenCalledWith("invoiced");
  });

  it("wires filter changes to the URL and clear to the state", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "city" }));
    expect(setFilter).toHaveBeenCalledWith("city", "BLR");
    fireEvent.click(screen.getByRole("button", { name: "se" }));
    expect(setFilter).toHaveBeenCalledWith("salesExecutiveId", "se1");
    fireEvent.click(screen.getByRole("button", { name: "clear" }));
    expect(clearFilters).toHaveBeenCalled();
  });

  it("shows the customer chip and clears it", () => {
    setup({ applied: { customerId: "c1" } });
    expect(screen.getByText(/Customer: Raj Motors/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Clear customer filter"));
    expect(setFilter).toHaveBeenCalledWith("customerId", "");
  });

  it("omits the chip when no customer is pinned", () => {
    setup();
    expect(screen.queryByText(/Customer:/)).not.toBeInTheDocument();
  });

  it("shows an error banner only when there's an error", () => {
    setup({ errorText: "Boom" });
    expect(screen.getByText("Boom")).toBeInTheDocument();
  });

  it("renders the new-items banner with its count and load handler", () => {
    const p = setup();
    expect(screen.getByTestId("banner")).toHaveAttribute("data-count", "4");
    fireEvent.click(screen.getByTestId("banner"));
    expect(p.onLoadNew).toHaveBeenCalled();
  });
});
