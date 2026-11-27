import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AdminDuesBody } from "./admin-dues-body";
import type { DuesSummary } from "../../lib/dues";

const band = (key: string, label: string, customers: number, outstanding: number) => ({
  key,
  label,
  fromDays: 0,
  toDays: null,
  customers,
  outstanding,
});

const summary = (over: Partial<DuesSummary> = {}): DuesSummary => ({
  bands: [],
  buckets: [band("b1", "0–30d", 2, 8000), band("b2", "61+d", 1, 3000)],
  totalCustomers: 3,
  totalOutstanding: 11000,
  ...over,
});

describe("AdminDuesBody", () => {
  it("shimmers when there is no summary yet", () => {
    const { container } = render(<AdminDuesBody summary={null} />);
    // Four placeholder cells, no values.
    expect(container.textContent).toContain("outstanding");
    expect(screen.queryByText("₹11,000")).not.toBeInTheDocument();
  });

  it("renders totals + bands and taps a band through to onBucket", () => {
    const onBucket = vi.fn();
    render(<AdminDuesBody summary={summary()} onBucket={onBucket} />);
    expect(screen.getByText("₹11,000")).toBeInTheDocument();
    expect(screen.getByText(/3 customers/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("0–30d"));
    expect(onBucket).toHaveBeenCalledWith("b1");
  });

  it("uses singular wording for a single customer", () => {
    render(<AdminDuesBody summary={summary({ totalCustomers: 1 })} />);
    expect(screen.getByText(/1 customer$/)).toBeInTheDocument();
  });
});
