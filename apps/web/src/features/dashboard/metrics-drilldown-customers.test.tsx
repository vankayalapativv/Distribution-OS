import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CustomerLevel } from "./metrics-drilldown-customers";
import type { CustomerRow, MetricKey } from "./metrics-helpers";

const row = (o: Record<string, unknown>) => o as unknown as CustomerRow;

describe("CustomerLevel", () => {
  it("shows the skeleton while rows are null", () => {
    const { container } = render(<CustomerLevel metric="collections" rows={null} />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });

  it("shows an empty state for no rows", () => {
    render(<CustomerLevel metric="collections" rows={[]} />);
    expect(screen.getByText("Nothing recorded in this period.")).toBeInTheDocument();
  });

  it("dispatches each metric family to its own row shape", () => {
    const cases: { metric: MetricKey; row: Record<string, unknown>; expect: string }[] = [
      { metric: "executives", row: { date: "2026-09-15", startedAt: "2026-09-15T09:00:00Z", lastPingAt: "2026-09-15T17:00:00Z", visits: 4 }, expect: "4 visits" },
      { metric: "visits", row: { customerId: "c1", customerName: "Ravi", planned: "planned", date: "2026-09-15", checkInAt: "2026-09-15T10:00:00Z", orders: [], collections: [] }, expect: "Planned" },
      { metric: "litres", row: { customerId: "c1", customerName: "Ravi", orderCode: "O1", date: "2026-09-15", createdAt: "2026-09-15T10:00:00Z", litres: 20, returnedLitres: 0 }, expect: "delivered" },
      { metric: "collections", row: { customerId: "c1", customerName: "Ravi", paymentMode: "Cash", date: "2026-09-15", createdAt: "2026-09-15T10:00:00Z", amount: 100, status: "verified" }, expect: "verified" },
    ];
    for (const c of cases) {
      const { unmount } = render(<CustomerLevel metric={c.metric} rows={[row(c.row)]} />);
      expect(screen.getByText(c.expect)).toBeInTheDocument();
      unmount();
    }
  });
});
