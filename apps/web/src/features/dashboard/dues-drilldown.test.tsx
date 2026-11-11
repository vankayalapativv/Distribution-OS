import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DuesDrilldownDialog } from "./dues-drilldown";
import type { DuesBucket, DuesCustomerRow } from "./dues-helpers";

const bucket: DuesBucket = { key: "45_60", label: "46–60d", customers: 3, outstanding: 4000 };
const row: DuesCustomerRow = {
  customerId: "c1", customerName: "Ravi Motors", city: "Guntur",
  executiveName: "Sandeep", bandOldestDate: "2026-08-01", bandAgeDays: 50, bandOutstanding: 4000, totalOutstanding: 6000,
};

describe("DuesDrilldownDialog", () => {
  it("renders nothing when no bucket is open", () => {
    render(<DuesDrilldownDialog bucket={null} rows={null} error={null} onOpenChange={vi.fn()} />);
    expect(screen.queryByText(/Collection dues/)).not.toBeInTheDocument();
  });

  it("shows an error message", () => {
    render(<DuesDrilldownDialog bucket={bucket} rows={null} error="Boom" onOpenChange={vi.fn()} />);
    expect(screen.getByText("Boom")).toBeInTheDocument();
    expect(screen.getByText(/Collection dues · 46–60d/)).toBeInTheDocument();
  });

  it("shows the skeleton while rows are loading", () => {
    render(<DuesDrilldownDialog bucket={bucket} rows={null} error={null} onOpenChange={vi.fn()} />);
    expect(screen.queryByText("No customers in this age band.")).not.toBeInTheDocument();
    expect(screen.getByText("Customer")).toBeInTheDocument(); // shared header
  });

  it("shows an empty state when there are no customers", () => {
    render(<DuesDrilldownDialog bucket={bucket} rows={[]} error={null} onOpenChange={vi.fn()} />);
    expect(screen.getByText("No customers in this age band.")).toBeInTheDocument();
  });

  it("renders the customer table when rows are present", () => {
    render(<DuesDrilldownDialog bucket={bucket} rows={[row]} error={null} onOpenChange={vi.fn()} />);
    expect(screen.getByRole("link", { name: "Ravi Motors" })).toBeInTheDocument();
  });
});
