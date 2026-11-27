import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { router } from "expo-router";
import { DuesCustomerRow, toneForAge } from "./dues-customer-row";

describe("toneForAge", () => {
  it("grades by how overdue the oldest invoice is (green → amber → orange → red)", () => {
    expect(toneForAge(0)).toBe("text-green-600");
    expect(toneForAge(30)).toBe("text-green-600");
    expect(toneForAge(31)).toBe("text-amber-600");
    expect(toneForAge(45)).toBe("text-amber-600");
    expect(toneForAge(46)).toBe("text-orange-600");
    expect(toneForAge(60)).toBe("text-orange-600");
    expect(toneForAge(61)).toBe("text-red-600");
    expect(toneForAge(126)).toBe("text-red-600");
  });
});

describe("DuesCustomerRow", () => {
  it("renders the customer + oldest-invoice line and taps through to their ledger", () => {
    (router.push as ReturnType<typeof vi.fn>).mockClear?.();
    render(
      <DuesCustomerRow
        customer={{
          customerId: "c1",
          customerName: "Sri Traders",
          oldestInvoiceDate: "2026-09-01",
          ageDays: 87,
          outstanding: 12500,
        }}
      />,
    );
    expect(screen.getByText("Sri Traders")).toBeInTheDocument();
    expect(screen.getByText(/Oldest invoice/)).toBeInTheDocument(); // dateLabel + ageDays rendered
    expect(screen.getByText("₹12,500")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Sri Traders"));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/ledger/[id]",
      params: { id: "c1", customerName: "Sri Traders" },
    });
  });
});
