import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DuesSkeleton, DuesTable } from "./dues-drilldown-table";
import type { DuesCustomerRow } from "./dues-helpers";

const rows: DuesCustomerRow[] = [
  { customerId: "c1", customerName: "Ravi Motors", city: "Guntur", executiveName: "Sandeep", bandOldestDate: "2026-08-01", bandAgeDays: 40, bandOutstanding: 5000, totalOutstanding: 8000 },
  { customerId: "c2", customerName: "No City Auto", city: "", executiveName: "", bandOldestDate: "2026-07-15", bandAgeDays: 57, bandOutstanding: 900, totalOutstanding: 900 },
];

describe("dues drilldown table", () => {
  it("DuesSkeleton renders the requested number of shimmer rows", () => {
    const { container } = render(<DuesSkeleton rows={4} />);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(4);
  });

  it("DuesTable links each customer, with city · executive under the name", () => {
    render(<DuesTable rows={rows} />);
    const link = screen.getByRole("link", { name: "Ravi Motors" });
    expect(link).toHaveAttribute("href", "/customers/c1");
    // Salesperson now sits in the subline next to the city.
    expect(screen.getByText("Guntur · Sandeep")).toBeInTheDocument();
    // Row with no city + no executive → no subline at all (no stray "—").
    expect(screen.queryByText("—")).not.toBeInTheDocument();
    expect(screen.getByText("40d")).toBeInTheDocument();
  });
});
