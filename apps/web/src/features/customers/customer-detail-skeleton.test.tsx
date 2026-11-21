import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CustomerDetailBodySkeleton } from "./customer-detail-skeleton";

describe("CustomerDetailBodySkeleton", () => {
  it("renders the static tab labels (first active) + shimmer cards", () => {
    const { container } = render(<CustomerDetailBodySkeleton />);
    for (const label of ["Details", "Orders", "Ledger", "Notes", "Visits", "Photos"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // Only the first tab carries the active-primary underline (the i === 0 branch).
    expect(container.querySelectorAll(".bg-primary").length).toBe(1);
    // 5 info cards, each with its own shimmer grid.
    expect(container.querySelectorAll(".shadow-sm").length).toBe(5);
  });
});
