import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({
  default: (p: { href: string; children: React.ReactNode }) => <a href={p.href}>{p.children}</a>,
}));
vi.mock("./customer-new-order-button", () => ({
  CustomerNewOrderButton: () => <button>+ New Order</button>,
}));
vi.mock("./customer-orders-rows", () => ({
  RowSkeleton: () => (
    <tr>
      <td>skeleton</td>
    </tr>
  ),
  OrderRow: (p: { order: { id: string; orderCode: string }; onOpen: (id: string) => void }) => (
    <tr onClick={() => p.onOpen(p.order.id)}>
      <td>{p.order.orderCode}</td>
    </tr>
  ),
}));

import { CustomerOrdersTab } from "./customer-orders-tab";
import type { Order } from "@/features/orders/orders-api";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const orders = [{ id: "o1", orderCode: "ORD-1" }] as unknown as Order[];
const base = {
  customerId: "c1",
  customerName: "Ravi Motors",
  actionConfig: cfg,
  canCreateOrder: true,
};

afterEach(() => push.mockClear());

describe("CustomerOrdersTab", () => {
  it("shows a View-all link (pluralized) and routes on row click", () => {
    render(<CustomerOrdersTab orders={orders} total={3} isLoading={false} {...base} />);
    expect(screen.getByRole("link", { name: /View all 3 orders/ })).toHaveAttribute(
      "href",
      "/orders?customerId=c1",
    );
    fireEvent.click(screen.getByText("ORD-1"));
    expect(push).toHaveBeenCalledWith("/orders/o1");
  });

  it("uses the singular 'order' when total is 1", () => {
    render(<CustomerOrdersTab orders={orders} total={1} isLoading={false} {...base} />);
    expect(screen.getByRole("link", { name: /View all 1 order →/ })).toBeInTheDocument();
  });

  it("renders skeleton rows while loading", () => {
    render(<CustomerOrdersTab orders={[]} total={0} isLoading {...base} />);
    expect(screen.getAllByText("skeleton")).toHaveLength(5);
  });

  it("shows the empty state (with the create button) when there are no orders", () => {
    render(<CustomerOrdersTab orders={[]} total={0} isLoading={false} {...base} />);
    expect(screen.getByText("No orders yet for this customer.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("hides the create button when the user cannot create orders", () => {
    render(
      <CustomerOrdersTab orders={[]} total={0} isLoading={false} {...base} canCreateOrder={false} />,
    );
    expect(screen.queryByRole("button", { name: "+ New Order" })).not.toBeInTheDocument();
  });
});
