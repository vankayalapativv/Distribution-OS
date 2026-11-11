import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./order-search-combobox", () => ({
  OrderSearchCombobox: <T,>(p: {
    triggerLabel: React.ReactNode;
    items: T[];
    getKey: (i: T) => string;
    isSelected: (i: T) => boolean;
    onSelect: (i: T) => void;
    renderItem: (i: T) => React.ReactNode;
    onOpenChange: (o: boolean) => void;
    onSearchChange: (v: string) => void;
    registerSearchInput: (el: HTMLInputElement | null) => void;
    emptyText: string;
  }) => (
    <div>
      <div data-testid="trigger">{p.triggerLabel}</div>
      <button data-testid="open" onClick={() => p.onOpenChange(true)} />
      <button data-testid="close" onClick={() => p.onOpenChange(false)} />
      <input data-testid="search" ref={p.registerSearchInput} onChange={(e) => p.onSearchChange(e.target.value)} />
      {p.items.length === 0 ? (
        <span data-testid="empty">{p.emptyText}</span>
      ) : (
        p.items.map((it) => (
          <button key={p.getKey(it)} data-testid="item" data-selected={p.isSelected(it)} onClick={() => p.onSelect(it)}>
            {p.renderItem(it)}
          </button>
        ))
      )}
    </div>
  ),
}));

import { OrderOilProductCombobox } from "./order-oil-product-combobox";
import type { Product } from "./orders-api";
import { emptyLineItem, type LineItemDraft } from "./orders-create-helpers";

const products: Product[] = [
  { id: "p1", productName: "Titan GT1", unit: "litres", segments: ["Car"], packSizes: [1, 5] },
  { id: "p2", productName: "Agri Super", unit: "litres", segments: ["Agri"], packSizes: [20] },
];

function setup(item: LineItemDraft, search = "") {
  const h = {
    onRegisterSearchInput: vi.fn(),
    onOpenProductPopover: vi.fn(),
    onCloseProductPopover: vi.fn(),
    onSelectProduct: vi.fn(),
    onProductSearchChange: vi.fn(),
  };
  render(
    <OrderOilProductCombobox index={0} item={item} products={products} search={search} popoverOpen {...h} />,
  );
  return h;
}

describe("OrderOilProductCombobox", () => {
  it("prompts to select when no product is chosen", () => {
    setup(emptyLineItem());
    expect(screen.getByTestId("trigger")).toHaveTextContent("Select product…");
  });

  it("shows the chosen product name and marks it selected", () => {
    setup({ ...emptyLineItem(), productId: "p1" });
    expect(screen.getByTestId("trigger")).toHaveTextContent("Titan GT1");
    const selected = screen.getAllByTestId("item").find((b) => b.dataset.selected === "true");
    expect(selected).toHaveTextContent("Titan GT1");
  });

  it("shows a fallback label when the selected id is unknown", () => {
    setup({ ...emptyLineItem(), productId: "ghost" });
    expect(screen.getByTestId("trigger")).toHaveTextContent("Product");
  });

  it("filters by the row's segment", () => {
    setup({ ...emptyLineItem(), segment: "Agri" });
    expect(screen.getByText("Agri Super")).toBeInTheDocument();
    expect(screen.queryByText("Titan GT1")).not.toBeInTheDocument();
  });

  it("filters by the search query", () => {
    setup(emptyLineItem(), "titan");
    expect(screen.getByText("Titan GT1")).toBeInTheDocument();
    expect(screen.queryByText("Agri Super")).not.toBeInTheDocument();
  });

  it("toggles the popover open and closed for its row", () => {
    const h = setup(emptyLineItem());
    fireEvent.click(screen.getByTestId("open"));
    expect(h.onOpenProductPopover).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByTestId("close"));
    expect(h.onCloseProductPopover).toHaveBeenCalledWith(0);
  });

  it("selecting an item and typing search report with the row index", () => {
    const h = setup(emptyLineItem());
    fireEvent.click(screen.getByText("Titan GT1"));
    expect(h.onSelectProduct).toHaveBeenCalledWith(0, "p1");
    fireEvent.change(screen.getByTestId("search"), { target: { value: "gt1" } });
    expect(h.onProductSearchChange).toHaveBeenCalledWith(0, "gt1");
    expect(h.onRegisterSearchInput).toHaveBeenCalled();
  });

  it("shows a segment-specific empty message when nothing matches", () => {
    setup({ ...emptyLineItem(), segment: "Commercial" });
    expect(screen.getByText('No products for "Commercial"')).toBeInTheDocument();
  });

  it("shows the generic empty message with no segment", () => {
    setup(emptyLineItem(), "zzz");
    expect(screen.getByText("No products found")).toBeInTheDocument();
  });
});
