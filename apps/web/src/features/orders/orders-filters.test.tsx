import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */
vi.mock("./search-select", () => ({
  SearchSelect: (p: any) => (
    <button data-testid="city-select" onClick={() => p.onSelect("BLR")}>
      {p.items.map((i: any) => `${p.getKey(i)}:${p.getLabel(i)}`).join(",")}
    </button>
  ),
}));
vi.mock("./orders-sales-exec-filter", () => ({
  OrdersSalesExecFilter: () => <div data-testid="se-filter" />,
}));
vi.mock("./orders-date-range-filter", () => ({
  OrdersDateRangeFilter: () => <div data-testid="date-filter" />,
}));
/* eslint-enable @typescript-eslint/no-explicit-any */

import { OrdersFilters } from "./orders-filters";
import type { SalesExecutive } from "./orders-api";

const base = {
  search: "",
  onSearchChange: vi.fn(),
  city: "",
  onCityChange: vi.fn(),
  cities: ["Ambala"],
  salesExecutiveId: "",
  onSalesExecChange: vi.fn(),
  salesExecutives: [{ id: "se1", name: "Anika" }] as SalesExecutive[],
  dateRange: undefined,
  onDateRangeChange: vi.fn(),
  onClear: vi.fn(),
  hasActiveFilters: false,
};

afterEach(() => vi.restoreAllMocks());

describe("OrdersFilters", () => {
  it("types into the search box", () => {
    const onSearchChange = vi.fn();
    render(<OrdersFilters {...base} onSearchChange={onSearchChange} />);
    fireEvent.change(screen.getByPlaceholderText(/ORD id, invoice/), { target: { value: "widget" } });
    expect(onSearchChange).toHaveBeenCalledWith("widget");
  });

  it("selects a city", () => {
    const onCityChange = vi.fn();
    render(<OrdersFilters {...base} onCityChange={onCityChange} />);
    fireEvent.click(screen.getByTestId("city-select"));
    expect(onCityChange).toHaveBeenCalledWith("BLR");
  });

  it("shows the SE filter only when there are executives", () => {
    const { rerender } = render(<OrdersFilters {...base} />);
    expect(screen.getByTestId("se-filter")).toBeInTheDocument();
    rerender(<OrdersFilters {...base} salesExecutives={[]} />);
    expect(screen.queryByTestId("se-filter")).not.toBeInTheDocument();
  });

  it("always renders the date filter", () => {
    render(<OrdersFilters {...base} />);
    expect(screen.getByTestId("date-filter")).toBeInTheDocument();
  });

  it("shows Clear only when filters are active, and fires it", () => {
    const onClear = vi.fn();
    const { rerender } = render(<OrdersFilters {...base} hasActiveFilters onClear={onClear} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClear).toHaveBeenCalled();
    rerender(<OrdersFilters {...base} hasActiveFilters={false} />);
    expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
  });
});
