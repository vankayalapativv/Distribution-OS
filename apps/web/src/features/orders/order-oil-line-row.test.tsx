import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock the popover-based SearchSelect with a native <select> so the row's onSelect
// wiring is driven synchronously (segment = 1st combobox, pack size = 2nd).
vi.mock("@/components/ui/search-select", () => ({
  SearchSelect: ({
    items,
    valueKey,
    getKey,
    getLabel,
    onSelect,
    disabled,
  }: {
    readonly items: { value: string; label: string }[];
    readonly valueKey: string;
    readonly getKey: (o: { value: string; label: string }) => string;
    readonly getLabel: (o: { value: string; label: string }) => string;
    readonly onSelect: (v: string) => void;
    readonly disabled?: boolean;
  }) => (
    <select value={valueKey} disabled={disabled} onChange={(e) => onSelect(e.target.value)}>
      {items.map((o) => (
        <option key={getKey(o)} value={getKey(o)}>
          {getLabel(o)}
        </option>
      ))}
    </select>
  ),
}));

import { OrderOilLineRow } from "./order-oil-line-row";
import type { Product } from "./orders-api";
import { emptyLineItem, type LineItemDraft } from "./orders-create-helpers";

const products: Product[] = [
  { id: "p1", productName: "Titan GT1", unit: "litres", segments: ["Car"], packSizes: [1, 5] },
  { id: "q1", productName: "Gear Oil 6203", unit: "quantity", segments: ["Car"], packSizes: [] },
];

function setup(item: LineItemDraft, opts: { canRemove?: boolean } = {}) {
  const h = {
    onRegisterSearchInput: vi.fn(),
    onUpdateLineItem: vi.fn(),
    onRemoveLineItem: vi.fn(),
    onOpenProductPopover: vi.fn(),
    onCloseProductPopover: vi.fn(),
    onSelectProduct: vi.fn(),
    onProductSearchChange: vi.fn(),
  };
  render(
    <OrderOilLineRow
      index={0}
      item={item}
      products={products}
      search=""
      popoverOpen={false}
      canRemove={opts.canRemove ?? true}
      {...h}
    />,
  );
  return h;
}

describe("OrderOilLineRow", () => {
  it("changing the segment updates the line", () => {
    const h = setup(emptyLineItem());
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "Car" } });
    expect(h.onUpdateLineItem).toHaveBeenCalledWith(0, "segment", "Car");
  });

  it("offers only the selected product's pack sizes and updates on change", () => {
    const h = setup({ ...emptyLineItem(), productId: "p1" });
    const pack = screen.getAllByRole("combobox")[1];
    expect(screen.getByRole("option", { name: "5 L" })).toBeInTheDocument();
    fireEvent.change(pack, { target: { value: "5" } });
    expect(h.onUpdateLineItem).toHaveBeenCalledWith(0, "packSizeLitres", 5);
  });

  it("clearing the pack size sends 0", () => {
    const h = setup({ ...emptyLineItem(), productId: "p1", packSizeLitres: 5 });
    fireEvent.change(screen.getAllByRole("combobox")[1], { target: { value: "" } });
    expect(h.onUpdateLineItem).toHaveBeenCalledWith(0, "packSizeLitres", 0);
  });

  it("shows a 'Pick product' pack placeholder until a product is chosen", () => {
    setup(emptyLineItem());
    expect(screen.getByRole("option", { name: "Pick product" })).toBeInTheDocument();
  });

  it("updates the quantity and shows live total litres", () => {
    const h = setup({ ...emptyLineItem(), productId: "p1", packSizeLitres: 5, quantityUnits: 4 });
    expect(screen.getByText("20 L")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "6" } });
    expect(h.onUpdateLineItem).toHaveBeenCalledWith(0, "quantityUnits", 6);
  });

  it("hides the total until pack size and quantity are both set", () => {
    setup({ ...emptyLineItem(), productId: "p1", quantityUnits: 4 });
    // The qty cell (spinbutton + optional total) carries no "L" total when pack size is 0.
    expect(screen.getByRole("spinbutton").parentElement?.textContent).not.toMatch(/L/);
  });

  it("shows 'By quantity' (no pack picker) for a quantity product", () => {
    setup({ ...emptyLineItem(), productId: "q1" });
    expect(screen.getByText("By quantity")).toBeInTheDocument();
    // Only the segment combobox remains (no pack-size select for quantity products).
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
  });

  it("removes the line when allowed", () => {
    const h = setup(emptyLineItem(), { canRemove: true });
    fireEvent.click(screen.getByRole("button", { name: "Remove line" }));
    expect(h.onRemoveLineItem).toHaveBeenCalledWith(0);
  });

  it("hides the remove control on the last row", () => {
    setup(emptyLineItem(), { canRemove: false });
    expect(screen.queryByRole("button", { name: "Remove line" })).not.toBeInTheDocument();
  });
});
