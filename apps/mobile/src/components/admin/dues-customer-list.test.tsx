import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { router } from "expo-router";
import { DuesCustomerList } from "./dues-customer-list";

const cust = (over: Record<string, unknown> = {}) => ({
  customerId: "c1",
  customerName: "Acme Traders",
  outstanding: 12000,
  executiveName: "Asha",
  ageDays: 45,
  ...over,
});

describe("DuesCustomerList", () => {
  it("shows the skeleton while loading", () => {
    const { container } = render(<DuesCustomerList listLoading customers={[]} />);
    expect(container.querySelector("div")).not.toBeNull();
    expect(screen.queryByText("No customers in this bucket.")).not.toBeInTheDocument();
  });

  it("shows the empty state", () => {
    render(<DuesCustomerList listLoading={false} customers={[]} />);
    expect(screen.getByText("No customers in this bucket.")).toBeInTheDocument();
  });

  it("renders customer rows and opens one on tap", () => {
    (router.push as ReturnType<typeof vi.fn>).mockClear?.();
    render(<DuesCustomerList listLoading={false} customers={[cust() as never]} />);
    expect(screen.getByText("Acme Traders")).toBeInTheDocument();
    expect(screen.getByText("₹12,000")).toBeInTheDocument();
    expect(screen.getByText(/Asha · 45 days/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Acme Traders"));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/customer/[id]",
      params: { id: "c1", name: "Acme Traders" },
    });
  });

  it("falls back to a dash for a missing executive name", () => {
    render(<DuesCustomerList listLoading={false} customers={[cust({ executiveName: "" }) as never]} />);
    expect(screen.getByText(/— · 45 days/)).toBeInTheDocument();
  });
});
