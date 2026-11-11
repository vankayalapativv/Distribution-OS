import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { OrderDetail } from "./orders-api";
import { OrderCancelledBanner, OrderShortClosedBanner, isShortClosed } from "./order-status-banners";

describe("OrderCancelledBanner", () => {
  it("shows the reason when a note is given", () => {
    render(<OrderCancelledBanner note="Duplicate order" />);
    expect(screen.getByText("Order cancelled")).toBeInTheDocument();
    expect(screen.getByText(/Duplicate order/)).toBeInTheDocument();
  });

  it("says none was recorded when the note is null", () => {
    render(<OrderCancelledBanner note={null} />);
    expect(screen.getByText(/No reason was recorded/)).toBeInTheDocument();
  });
});

describe("OrderShortClosedBanner", () => {
  it("shows the reason when a note is given", () => {
    render(<OrderShortClosedBanner note="Out of stock" />);
    expect(screen.getByText(/short-closed/)).toBeInTheDocument();
    expect(screen.getByText(/Out of stock/)).toBeInTheDocument();
  });

  it("omits the reason line when the note is null", () => {
    render(<OrderShortClosedBanner note={null} />);
    expect(screen.queryByText(/Reason:/)).not.toBeInTheDocument();
  });
});

describe("isShortClosed", () => {
  const base = { orderStatus: "pending", skuProgress: [] } as unknown as OrderDetail;

  it("is true when not cancelled but a line has a cancelled remainder", () => {
    expect(isShortClosed({ ...base, skuProgress: [{ cancelledUnits: 3 }] } as unknown as OrderDetail)).toBe(true);
  });

  it("is false for a cancelled order or when nothing was cancelled", () => {
    expect(isShortClosed({ ...base, orderStatus: "cancelled", skuProgress: [{ cancelledUnits: 3 }] } as unknown as OrderDetail)).toBe(false);
    expect(isShortClosed(base)).toBe(false);
  });

  it("tolerates a missing skuProgress array", () => {
    expect(isShortClosed({ orderStatus: "pending" } as unknown as OrderDetail)).toBe(false);
  });

  it("treats a progress row with no cancelledUnits field as not short-closed", () => {
    expect(
      isShortClosed({ orderStatus: "pending", skuProgress: [{ invoicedUnits: 1 }] } as unknown as OrderDetail),
    ).toBe(false);
  });
});
