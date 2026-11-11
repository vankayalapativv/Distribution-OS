import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./order-oil-line-row", () => ({
  OrderOilLineRow: ({ index, canRemove }: { readonly index: number; readonly canRemove: boolean }) => (
    <div data-testid="oil-row">
      row {index} {canRemove ? "removable" : "locked"}
    </div>
  ),
}));

import { OrderOilLines } from "./order-oil-lines";
import { emptyLineItem, type LineItemDraft } from "./orders-create-helpers";

function setup(lineItems: LineItemDraft[]) {
  const onAddLineItem = vi.fn();
  render(
    <OrderOilLines
      products={[]}
      lineItems={lineItems}
      productSearches={[]}
      productPopoverOpen={[]}
      onRegisterSearchInput={vi.fn()}
      onUpdateLineItem={vi.fn()}
      onAddLineItem={onAddLineItem}
      onRemoveLineItem={vi.fn()}
      onOpenProductPopover={vi.fn()}
      onCloseProductPopover={vi.fn()}
      onSelectProduct={vi.fn()}
      onProductSearchChange={vi.fn()}
    />,
  );
  return { onAddLineItem };
}

describe("OrderOilLines", () => {
  it("renders one row per line and locks removal when only one row exists", () => {
    setup([emptyLineItem()]);
    expect(screen.getByTestId("oil-row")).toHaveTextContent("row 0 locked");
  });

  it("allows removal once there is more than one row", () => {
    setup([emptyLineItem(), emptyLineItem()]);
    expect(screen.getAllByTestId("oil-row")).toHaveLength(2);
    expect(screen.getAllByTestId("oil-row")[0]).toHaveTextContent("removable");
  });

  it("adds a line from the footer button", () => {
    const { onAddLineItem } = setup([emptyLineItem()]);
    fireEvent.click(screen.getByRole("button", { name: /Add item/ }));
    expect(onAddLineItem).toHaveBeenCalled();
  });

  it("shows the summed total litres only when a pack size is set", () => {
    setup([
      { uid: "a", brand: "", segment: "", productId: "p", packSizeLitres: 5, quantityUnits: 4 },
      { uid: "b", brand: "", segment: "", productId: "p", packSizeLitres: 0, quantityUnits: 9 },
    ]);
    expect(screen.getByText(/20\s*L/)).toBeInTheDocument();
  });

  it("hides the total when no line has a pack size", () => {
    setup([emptyLineItem()]);
    expect(screen.queryByText(/Total:/)).not.toBeInTheDocument();
  });
});
