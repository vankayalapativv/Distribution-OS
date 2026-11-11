import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./order-detail-item-row", () => ({
  OrderDetailItemRow: ({ item }: { readonly item: { id: string } }) => (
    <tr data-testid="item-row">
      <td>{item.id}</td>
    </tr>
  ),
}));

import { OrderDetailItems } from "./order-detail-items";
import type { OrderItem, SkuProgress } from "./orders-api";

const item = (id: string): OrderItem =>
  ({
    id, productId: "p", productName: "Oil", brand: null,
    quantityUnits: 1, packSizeLitres: 1, totalLitres: 1, segment: null, hsnCode: null,
  }) as OrderItem;

const sku = (over: Partial<SkuProgress>): SkuProgress =>
  ({
    orderItemId: "i1", label: "x", packSizeLitres: 1,
    orderedUnits: 1, cancelledUnits: 0, invoicedUnits: 1, remainingUnits: 0, returnedUnits: 0, ...over,
  }) as SkuProgress;

describe("OrderDetailItems", () => {
  it("shows an empty message with no items", () => {
    render(<OrderDetailItems items={[]} />);
    expect(screen.getByText("No line items.")).toBeInTheDocument();
  });

  it("renders a row per item and only the base columns without progress", () => {
    render(<OrderDetailItems items={[item("i1"), item("i2")]} />);
    expect(screen.getAllByTestId("item-row")).toHaveLength(2);
    expect(screen.queryByText("Invoiced")).not.toBeInTheDocument();
    expect(screen.queryByText("Cancelled")).not.toBeInTheDocument();
    expect(screen.queryByText("Returned")).not.toBeInTheDocument();
  });

  it("adds Invoiced/Remaining columns when progress is present", () => {
    render(<OrderDetailItems items={[item("i1")]} progress={[sku({ orderItemId: "i1" })]} />);
    expect(screen.getByText("Invoiced")).toBeInTheDocument();
    expect(screen.getByText("Remaining")).toBeInTheDocument();
  });

  it("adds the Cancelled column only when something was short-closed", () => {
    render(<OrderDetailItems items={[item("i1")]} progress={[sku({ cancelledUnits: 2 })]} />);
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });

  it("adds the Returned column only when something was returned", () => {
    render(<OrderDetailItems items={[item("i1")]} progress={[sku({ returnedUnits: 1 })]} />);
    expect(screen.getByText("Returned")).toBeInTheDocument();
  });

  it("treats missing returned/cancelled unit fields as zero (columns hidden)", () => {
    const partial = { orderItemId: "i1", label: "x", invoicedUnits: 1, remainingUnits: 0 } as unknown as SkuProgress;
    render(<OrderDetailItems items={[item("i1")]} progress={[partial]} />);
    expect(screen.getByText("Invoiced")).toBeInTheDocument(); // progress present
    expect(screen.queryByText("Cancelled")).not.toBeInTheDocument();
    expect(screen.queryByText("Returned")).not.toBeInTheDocument();
  });
});
