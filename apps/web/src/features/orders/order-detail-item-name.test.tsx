import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { OrderItem } from "./orders-api";
import { OrderDetailItemName } from "./order-detail-item-name";

function item(over: Partial<OrderItem> = {}): OrderItem {
  return {
    id: "i1", productId: "p1", productName: "Titan GT1",     brand: null,
    quantityUnits: 1, packSizeLitres: null, totalLitres: null, segment: null, hsnCode: null,
    ...over,
  };
}

describe("OrderDetailItemName", () => {
  it("shows the product name for a normal oil line", () => {
    render(<OrderDetailItemName item={item()} />);
    expect(screen.getByText("Titan GT1")).toBeInTheDocument();
  });

  it("falls back to an em-dash when a product has no name", () => {
    render(<OrderDetailItemName item={item({ productName: null })} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
