import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MetricsCards } from "./metrics-cards";
import type { DashboardMetrics } from "./metrics-helpers";

const metrics: DashboardMetrics = {
  range: { from: "2026-09-15", to: "2026-09-15" },
  activeExecutives: { live: 0, total: 6 }, // → executives card wants attention
  visits: 10,
  productiveVisits: 5,
  sales: { litres: 100, orders: 3 },
  orderedOils: { litres: 120, orders: 4 },
  oilsByBrand: [
    { brand: "Fuchs", litres: 80, orders: 2 },
    { brand: "Savsol", litres: 40, orders: 1 },
  ],
  collections: { total: 5000, verified: 2000, pendingCount: 2, count: 4 }, // → attention
};

describe("MetricsCards", () => {
  it("renders the fixed metric cards (Visits/Productive/Bearings merged away)", () => {
    render(<MetricsCards metrics={metrics} loading={false} onOpen={vi.fn()} />);
    expect(screen.getByText("Active Executives")).toBeInTheDocument();
    expect(screen.getByText("Productivity")).toBeInTheDocument();
    expect(screen.getByText("Sold Oil")).toBeInTheDocument();
    expect(screen.getByText("Total Ordered Oils")).toBeInTheDocument();
    expect(screen.getByText("Collections")).toBeInTheDocument();
    // No standalone Visits / Productive Visits / Bearings cards any more.
    expect(screen.queryByText("Visits")).not.toBeInTheDocument();
    expect(screen.queryByText("Productive Visits")).not.toBeInTheDocument();
    expect(screen.queryByText("Bearings")).not.toBeInTheDocument();
    // The merged Productivity card carries the visits·productive subline.
    expect(screen.getByText(/10 visits · 5 productive/)).toBeInTheDocument();
    // 5 interactive metric cards (brand tiles are non-interactive).
    expect(screen.getAllByRole("button")).toHaveLength(5);
  });

  it("renders one non-interactive tile per oil brand (dynamic)", () => {
    render(<MetricsCards metrics={metrics} loading={false} onOpen={vi.fn()} />);
    expect(screen.getByText("Fuchs")).toBeInTheDocument();
    expect(screen.getByText("Savsol")).toBeInTheDocument();
    // Brand tiles are divs, not buttons → still only 5 buttons total.
    expect(screen.getByText("Fuchs").closest("button")).toBeNull();
  });

  it("calls onOpen with the metric key when a card is clicked", () => {
    const onOpen = vi.fn();
    render(<MetricsCards metrics={metrics} loading={false} onOpen={onOpen} />);
    fireEvent.click(screen.getByText("Sold Oil").closest("button")!);
    expect(onOpen).toHaveBeenCalledWith("litres");
  });

  it("applies the amber attention accent (executives + collections)", () => {
    const { container } = render(<MetricsCards metrics={metrics} loading={false} onOpen={vi.fn()} />);
    expect(container.querySelectorAll(".border-l-amber-400").length).toBe(2);
    expect(container.querySelector(".border-l-sky-300")).toBeTruthy();
  });

  it("dims the grid while loading", () => {
    const { container } = render(<MetricsCards metrics={metrics} loading onOpen={vi.fn()} />);
    expect(container.querySelector("section")!.className).toContain("opacity-70");
  });
});
