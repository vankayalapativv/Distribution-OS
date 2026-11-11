import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/orders/orders-columns", () => ({
  FulfillmentBadge: (p: { status: string | null }) => <span>FB:{p.status ?? "none"}</span>,
  InvoiceCell: (p: { invoices: unknown[] }) => <span>INV:{p.invoices?.length ?? 0}</span>,
}));
vi.mock("@/lib/format", () => ({ formatDate: (d: string) => `d:${d}` }));

import { OrderRow, RowSkeleton } from "./customer-orders-rows";
import type { Order } from "@/features/orders/orders-api";

const order = (over: Partial<Order> = {}): Order =>
  ({
    id: "o1",
    orderCode: "ORD-001",
    invoices: [{}],
    orderDate: "2026-07-01",
    salesExecutiveName: "Ravi",
    totalLitres: 40,
    fulfillmentStatus: "invoiced",
    ...over,
  }) as unknown as Order;

describe("RowSkeleton", () => {
  it("renders six placeholder cells", () => {
    render(
      <table>
        <tbody>
          <RowSkeleton />
        </tbody>
      </table>,
    );
    expect(document.querySelectorAll("td")).toHaveLength(6);
  });
});

describe("OrderRow", () => {
  it("renders order fields and fires onOpen with the id on click", () => {
    const onOpen = vi.fn();
    render(
      <table>
        <tbody>
          <OrderRow order={order()} onOpen={onOpen} />
        </tbody>
      </table>,
    );
    expect(screen.getByText("ORD-001")).toBeInTheDocument();
    expect(screen.getByText("d:2026-07-01")).toBeInTheDocument();
    expect(screen.getByText("Ravi")).toBeInTheDocument();
    expect(screen.getByText("40 L")).toBeInTheDocument();
    expect(screen.getByText("FB:invoiced")).toBeInTheDocument();
    expect(screen.getByText("INV:1")).toBeInTheDocument();
    fireEvent.click(screen.getByText("ORD-001").closest("tr")!);
    expect(onOpen).toHaveBeenCalledWith("o1");
  });

  it("falls back to em dashes for a missing exec and litres", () => {
    render(
      <table>
        <tbody>
          <OrderRow order={order({ salesExecutiveName: null, totalLitres: null })} onOpen={vi.fn()} />
        </tbody>
      </table>,
    );
    expect(screen.getAllByText("—")).toHaveLength(2);
  });
});
