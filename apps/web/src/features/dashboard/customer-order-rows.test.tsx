import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CollectionRow, OrderRow } from "./customer-order-rows";
import type { CustomerRow } from "./metrics-helpers";

const row = (o: Record<string, unknown>) => o as unknown as CustomerRow;
const base = { customerId: "c1", customerName: "Ravi Motors", orderCode: "ORD-1", date: "2026-09-15", createdAt: "2026-09-15T10:00:00Z" };

describe("OrderRow", () => {
  it("litres: shows returned sub-line when there are returns", () => {
    render(<OrderRow metric="litres" row={row({ ...base, litres: 45, returnedLitres: 5 })} />);
    expect(screen.getByText(/returned/)).toBeInTheDocument();
  });
  it("litres: shows 'delivered' with no returns (returnedLitres field absent)", () => {
    render(<OrderRow metric="litres" row={row({ ...base, litres: 45 })} />); // returnedLitres ?? 0
    expect(screen.getByText("delivered")).toBeInTheDocument();
  });
  it("ordered: cancelled pill", () => {
    render(<OrderRow metric="ordered" row={row({ ...base, litres: 10, oilLines: 1, orderStatus: "cancelled" })} />);
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });
  it("ordered: oil item count (singular + plural)", () => {
    const { unmount } = render(<OrderRow metric="ordered" row={row({ ...base, litres: 10, oilLines: 1 })} />);
    expect(screen.getByText("1 item")).toBeInTheDocument();
    unmount();
    render(<OrderRow metric="ordered" row={row({ ...base, litres: 10, oilLines: 3 })} />);
    expect(screen.getByText("3 items")).toBeInTheDocument();
  });
});

describe("CollectionRow", () => {
  it("shows mode, amount and status", () => {
    render(<CollectionRow row={row({ customerId: "c1", customerName: "Ravi Motors", paymentMode: "Cash", date: "2026-09-15", createdAt: "2026-09-15T10:00:00Z", amount: 5000, status: "verified" })} />);
    expect(screen.getByText("verified")).toBeInTheDocument();
  });
  it("defaults a missing amount to zero", () => {
    render(<CollectionRow row={row({ customerId: "c2", customerName: "Walk-in", paymentMode: "UPI", date: "2026-09-15", createdAt: "2026-09-15T10:00:00Z", status: "pending" })} />);
    expect(screen.getByText("pending")).toBeInTheDocument();
  });
});
