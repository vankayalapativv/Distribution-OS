import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExecutivePerformanceTable } from "./executive-performance";
import type { ExecutivePerformanceRow } from "./dashboard-experience";

const rows: ExecutivePerformanceRow[] = [
  { name: "Anika Sharma", visits: 8, productiveVisits: 6, salesValue: "92000", collections: "36000", gpsStatus: "active" },
  { name: "Ravi Kumar", visits: 3, productiveVisits: 1, salesValue: "10000", collections: "0", gpsStatus: "offline" },
];

describe("ExecutivePerformanceTable", () => {
  it("renders a row per executive with their figures", () => {
    render(<ExecutivePerformanceTable rows={rows} />);
    expect(screen.getByText("Anika Sharma")).toBeInTheDocument();
    expect(screen.getByText("Ravi Kumar")).toBeInTheDocument();
    expect(screen.getByText("92000")).toBeInTheDocument();
    // Column headers present.
    expect(screen.getByText("Executive")).toBeInTheDocument();
    expect(screen.getByText("Collections")).toBeInTheDocument();
  });

  it("shows an active vs inactive GPS badge (both branches)", () => {
    render(<ExecutivePerformanceTable rows={rows} />);
    const active = screen.getByText("active");
    const offline = screen.getByText("offline");
    expect(active.className).toContain("text-green-700");
    expect(offline.className).toContain("text-slate-600");
  });

  it("renders just the header when there are no rows", () => {
    render(<ExecutivePerformanceTable rows={[]} />);
    expect(screen.getByText("Sales Executive Performance")).toBeInTheDocument();
    expect(screen.queryByText("Anika Sharma")).not.toBeInTheDocument();
  });
});
