import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderDetailBody } from "./order-detail-body";
import type { OrderDetail } from "../lib/order-detail";

const detail = (over: Partial<OrderDetail> = {}): OrderDetail => ({
  orderCode: "ORD-001",
  orderDate: "2026-11-27",
  orderStatus: null,
  totalLitres: 15,
  items: [
    { name: "Shell Helix", kind: "oil", segment: "Car", packSizeLitres: 1, totalLitres: 10, quantityUnits: 10 },
    { name: "Castrol GTX", kind: "oil", segment: null, packSizeLitres: null, totalLitres: null, quantityUnits: 5 },
  ],
  ...over,
});

describe("OrderDetailBody", () => {
  it("renders the header, items (with/without pack + litres) and totals", () => {
    render(<OrderDetailBody detail={detail()} fulfillment="delivered" />);
    expect(screen.getByText("ORD-001")).toBeInTheDocument();
    expect(screen.getByText("Delivered")).toBeInTheDocument(); // known fulfillment label
    expect(screen.getByText("Shell Helix")).toBeInTheDocument();
    expect(screen.getByText(/Car · 1 L pack/)).toBeInTheDocument();
    expect(screen.getByText(/Oil/)).toBeInTheDocument(); // null segment → "Oil", no pack
    expect(screen.getByText("15 L")).toBeInTheDocument(); // totals
  });

  it("falls back to a humanized status for an unknown fulfillment, and shows a dash for zero litres", () => {
    render(
      <OrderDetailBody
        detail={detail({ orderCode: null, orderDate: null, totalLitres: 0 })}
        fulfillment="weird_state"
      />,
    );
    expect(screen.getByText("Order")).toBeInTheDocument(); // null orderCode fallback
    expect(screen.getByText(/Weird state|weird/i)).toBeInTheDocument(); // formatStatus fallback
    expect(screen.getByText("—")).toBeInTheDocument(); // zero totalLitres
  });

  it("shows an empty-items message", () => {
    render(<OrderDetailBody detail={detail({ items: [] })} fulfillment="ordered" />);
    expect(screen.getByText("No line items recorded.")).toBeInTheDocument();
  });
});
