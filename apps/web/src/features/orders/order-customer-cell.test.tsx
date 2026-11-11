import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrderCustomerCell } from "./order-customer-cell";
import type { Order } from "./orders-api";

const order = (over: Partial<Order>): Order =>
  ({
    customerName: "Raj Motors",
    addressCity: "Bengaluru",
    salesExecutiveName: "Anika",
    customerType: "retail",
    customerPhone: "7893284264",
    segment: null,
    ...over,
  }) as Order;

describe("OrderCustomerCell", () => {
  it("renders name, the City · Executive · Type line, and the grouped phone", () => {
    render(<OrderCustomerCell order={order({})} />);
    expect(screen.getByText("Raj Motors")).toBeInTheDocument();
    expect(screen.getByText(/Bengaluru · Anika ·/)).toBeInTheDocument();
    expect(screen.getByText("+91 78932 84264")).toBeInTheDocument();
  });

  it("falls back to — for a missing name and drops empty meta/phone lines", () => {
    const { container } = render(
      <OrderCustomerCell order={order({ customerName: null, addressCity: null, salesExecutiveName: null, customerType: null, customerPhone: null })} />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
    // Only the name row remains (no meta line, no phone line).
    expect(container.querySelectorAll("span.text-xs")).toHaveLength(0);
  });

  it("uses the raw customer type when it isn't a known label", () => {
    render(<OrderCustomerCell order={order({ customerType: "wholesale" })} />);
    expect(screen.getByText(/wholesale/)).toBeInTheDocument();
  });
});
