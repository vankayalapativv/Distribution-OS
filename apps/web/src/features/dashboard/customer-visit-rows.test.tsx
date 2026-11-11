import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExecutiveDayRow, VisitRow } from "./customer-visit-rows";
import type { CustomerRow } from "./metrics-helpers";

const row = (o: Record<string, unknown>) => o as unknown as CustomerRow;

describe("ExecutiveDayRow", () => {
  it("shows the day, session window and visit count", () => {
    render(<ExecutiveDayRow row={row({ date: "2026-09-15", startedAt: "2026-09-15T09:00:00Z", lastPingAt: "2026-09-15T17:00:00Z", visits: 12 })} />);
    expect(screen.getByText("12 visits")).toBeInTheDocument();
    expect(screen.getByText(/started/)).toBeInTheDocument();
  });
});

describe("VisitRow", () => {
  it("planned check-in with order + collection outcomes and a checkout", () => {
    render(
      <VisitRow row={row({
        customerId: "c1", customerName: "Ravi Motors", planned: "planned", date: "2026-09-15",
        checkInAt: "2026-09-15T10:00:00Z", checkOutAt: "2026-09-15T10:30:00Z",
        orders: [{ id: "o1", code: "ORD-1", litres: 45 }],
        collections: [{ id: "cl1", code: "COLL-1", amount: 5000 }],
      })} />,
    );
    expect(screen.getByText("Planned")).toBeInTheDocument();
    expect(screen.getByText("ORD-1")).toBeInTheDocument();
    expect(screen.getByText("COLL-1")).toBeInTheDocument();
    expect(screen.getByText(/out /)).toBeInTheDocument();
  });

  it("unplanned check-in with undefined outcome arrays and no checkout", () => {
    // orders/collections omitted → the Array.isArray(...) ? ... : [] false branch.
    render(
      <VisitRow row={row({
        customerId: "c2", customerName: "No Sale Auto", planned: "unplanned",
        date: "2026-09-15", checkInAt: "2026-09-15T11:00:00Z",
      })} />,
    );
    expect(screen.getByText("Unplanned")).toBeInTheDocument();
    expect(screen.getByText("— No order or collection")).toBeInTheDocument();
  });

  it("treats a missing planned flag as unplanned", () => {
    // planned omitted → `planned ?? ""` default → not "planned".
    render(<VisitRow row={row({ customerId: "c3", customerName: "X", date: "2026-09-15", checkInAt: "2026-09-15T11:00:00Z", orders: [], collections: [] })} />);
    expect(screen.getByText("Unplanned")).toBeInTheDocument();
  });
});
