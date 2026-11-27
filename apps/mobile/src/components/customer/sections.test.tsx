import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { OrdersSection } from "./orders-section";
import { CollectionsSection } from "./collections-section";

const q = (over: Record<string, unknown> = {}) =>
  ({ data: [], isPending: false, isError: false, error: null, refetch: vi.fn(), ...over }) as never;

describe("OrdersSection", () => {
  it("shows skeleton / error / empty / rows", () => {
    const onOpen = vi.fn();
    const refetch = vi.fn();
    const { rerender } = render(<OrdersSection query={q({ isPending: true, data: undefined }) as never} onOpen={onOpen} />);
    expect(screen.getByText("Last 5 orders")).toBeInTheDocument();
    rerender(<OrdersSection query={q({ isError: true, error: new Error("x"), refetch }) as never} onOpen={onOpen} />);
    fireEvent.click(screen.getByText("Try again"));
    expect(refetch).toHaveBeenCalled();
    rerender(<OrdersSection query={q() as never} onOpen={onOpen} />);
    expect(screen.getByText("No orders recorded yet.")).toBeInTheDocument();
    rerender(
      <OrdersSection
        query={q({ data: [{ id: "o1", orderCode: "ORD-1", fulfillmentStatus: "delivered", orderDate: "2026-11-27T00:00:00Z", totalLitres: 15 }] }) as never}
        onOpen={onOpen}
      />,
    );
    expect(screen.getByText("ORD-1")).toBeInTheDocument();
    expect(screen.getByText("Delivered")).toBeInTheDocument();
    fireEvent.click(screen.getByText("ORD-1"));
    expect(onOpen).toHaveBeenCalled();
  });

  it("falls back for a missing fulfillment status / litres and an unknown status", () => {
    render(
      <OrdersSection
        query={q({
          data: [
            { id: "o2", orderCode: "ORD-2", fulfillmentStatus: null, orderDate: null, totalLitres: null },
            { id: "o3", orderCode: "ORD-3", fulfillmentStatus: "weird_state", orderDate: null, totalLitres: null },
          ],
        }) as never}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByText("Ordered")).toBeInTheDocument(); // null → default fulfillment
    expect(screen.getByText("ORD-3")).toBeInTheDocument(); // unknown status → formatStatus fallback chip
  });
});

describe("CollectionsSection", () => {
  it("shows skeleton / error / empty / rows", () => {
    const refetch = vi.fn();
    const { rerender } = render(<CollectionsSection query={q({ isPending: true, data: undefined }) as never} />);
    expect(screen.getByText("Last 5 collections")).toBeInTheDocument();
    rerender(<CollectionsSection query={q({ isError: true, error: new Error("x"), refetch }) as never} />);
    fireEvent.click(screen.getByText("Try again"));
    expect(refetch).toHaveBeenCalled();
    rerender(<CollectionsSection query={q() as never} />);
    expect(screen.getByText("No collections recorded yet.")).toBeInTheDocument();
    rerender(
      <CollectionsSection
        query={q({ data: [
          { id: "cl1", collectionAmount: 5000, paymentMode: "cash", accountantApprovalStatus: "verified", collectionCode: "RCP-1", collectionDate: "2026-11-27T00:00:00Z" },
          { id: "cl2", collectionAmount: 10, paymentMode: "upi", accountantApprovalStatus: "weird_state", collectionCode: "RCP-2", collectionDate: null },
        ] }) as never}
      />,
    );
    expect(screen.getByText(/₹5,000/)).toBeInTheDocument();
    expect(screen.getByText("RCP-1 · 2026-11-27")).toBeInTheDocument();
    expect(screen.getByText(/RCP-2/)).toBeInTheDocument(); // unknown status → chip fallback, null date
  });
});
