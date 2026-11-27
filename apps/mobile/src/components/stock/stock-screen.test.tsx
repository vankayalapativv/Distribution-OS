import { beforeEach, describe, expect, it, vi } from "vitest";

const stock = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("../../lib/use-available-stock", () => ({ useAvailableStock: () => stock.value }));

import { fireEvent, render, screen } from "@testing-library/react";
import { StockScreen } from "./stock-screen";

const make = (over: Record<string, unknown> = {}) => ({
  query: { isPending: false, isError: false, data: { products: [] }, error: null, refetch: vi.fn() },
  products: [] as unknown[],
  godowns: [],
  search: "",
  setSearch: vi.fn(),
  searching: false,
  ...over,
});

beforeEach(() => {
  stock.value = make();
});

describe("StockScreen", () => {
  it("renders the skeleton while pending", () => {
    stock.value = make({ query: { ...make().query, isPending: true } });
    const { container } = render(<StockScreen />);
    expect(screen.getByText("Stock")).toBeInTheDocument();
    expect(container.querySelector("div")).not.toBeNull();
  });

  it("renders the error state when the fetch fails with no cached data, and retries", () => {
    const refetch = vi.fn();
    stock.value = make({ query: { isPending: false, isError: true, data: undefined, error: new Error("down"), refetch } });
    render(<StockScreen />);
    fireEvent.click(screen.getByText("Try again"));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows the empty state (and the search-specific variant)", () => {
    render(<StockScreen />);
    expect(screen.getByText("No stock on hand yet.")).toBeInTheDocument();
  });

  it("shows the no-match message while searching", () => {
    stock.value = make({ searching: true, search: "zzz" });
    render(<StockScreen />);
    expect(screen.getByText(/No products match/)).toBeInTheDocument();
  });

  it("renders the product list and clears the search", () => {
    const setSearch = vi.fn();
    stock.value = make({
      search: "shell",
      setSearch,
      products: [{ productId: "p1", productName: "Shell Helix", brand: "Shell", segment: "Car", unit: "litres", totalUnits: 10, packs: [] }],
    });
    render(<StockScreen />);
    expect(screen.getByText("Shell Helix")).toBeInTheDocument();
    fireEvent.click(screen.getByText("✕")); // clear search (search is non-empty)
    expect(setSearch).toHaveBeenCalledWith("");
  });

  it("types into the search field", () => {
    const setSearch = vi.fn();
    stock.value = make({ setSearch });
    render(<StockScreen />);
    fireEvent.change(screen.getByPlaceholderText(/Search product or brand/), { target: { value: "oil" } });
    expect(setSearch).toHaveBeenCalledWith("oil");
  });
});
