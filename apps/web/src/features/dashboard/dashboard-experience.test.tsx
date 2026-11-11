import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import {
  DashboardExperience,
  type DashboardExperienceData,
} from "./dashboard-experience";
import type { DashboardMetrics } from "./metrics-dashboard";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
}));

// The metrics dashboard fetches on mount; stub it so these tests stay focused
// on the shell (nav + which body renders per role).
vi.stubGlobal(
  "fetch",
  vi.fn(async () =>
    Response.json({ success: true, data: buildMetrics() }),
  ),
);

const dashboardData: DashboardExperienceData = {
  metrics: [
    { label: "Sales Value", value: "185000" },
    { label: "Collections", value: "74000" },
    { label: "Productive Visits", value: "12" },
  ],
  executivePerformance: [
    {
      name: "Anika Sharma",
      visits: 8,
      productiveVisits: 6,
      salesValue: "92000",
      collections: "36000",
      gpsStatus: "active",
    },
  ],
};

function buildMetrics(): DashboardMetrics {
  return {
    range: { from: "2026-07-20", to: "2026-07-20" },
    activeExecutives: { live: 2, total: 6 },
    visits: 14,
    productiveVisits: 9,
    sales: { litres: 431, orders: 6 },
    orderedOils: { litres: 512, orders: 8 },
    oilsByBrand: [],
    collections: { total: 48500, verified: 12000, pendingCount: 3, count: 7 },
  };
}

const metricsProp = {
  actionConfig: { apiBaseUrl: "http://api.test", authToken: "t" },
  initial: buildMetrics(),
};

describe("DashboardExperience", () => {
  test("Super Admin sees its own nav and the live metric cards", () => {
    render(
      <DashboardExperience
        role="SUPER_ADMIN"
        dashboardData={dashboardData}
        metrics={metricsProp}
      />,
    );

    // Super-Admin-only nav entries (Manager has no Products-less "Audit Logs").
    expect(screen.getByText("Audit Logs")).toBeInTheDocument();
    expect(screen.getByText("Live Tracking")).toBeInTheDocument();

    // The live metric cards replace the legacy list + performance table.
    expect(screen.getByText("Active Executives")).toBeInTheDocument();
    expect(screen.getByText("Productivity")).toBeInTheDocument();
    expect(screen.getByText("Total Ordered Oils")).toBeInTheDocument();
    expect(screen.getByText("Sold Oil")).toBeInTheDocument();
    expect(screen.getByText("₹48,500")).toBeInTheDocument(); // Collections card value
    // Visits / Productive Visits / Bearings cards were merged/removed.
    expect(screen.queryByText("Visits")).not.toBeInTheDocument();
    expect(screen.queryByText("Bearings")).not.toBeInTheDocument();
    expect(screen.queryByText("Anika Sharma")).not.toBeInTheDocument();
  });

  test("Manager sees team nav and the same live metric cards", () => {
    render(
      <DashboardExperience
        role="MANAGER"
        dashboardData={dashboardData}
        metrics={metricsProp}
      />,
    );

    // Manager nav (no Super-Admin-only Audit Logs / Users & Teams).
    expect(screen.getByText("Beat Plans")).toBeInTheDocument();
    expect(screen.getByText("Market Intelligence")).toBeInTheDocument();
    expect(screen.queryByText("Audit Logs")).not.toBeInTheDocument();

    expect(screen.getByText("Active Executives")).toBeInTheDocument();
    expect(screen.getByText("Productivity")).toBeInTheDocument();
  });

  test("Accountant keeps the legacy cards (no live metrics prop)", () => {
    render(
      <DashboardExperience role="ACCOUNTANT" dashboardData={dashboardData} />,
    );

    // Accountant nav (Finance section).
    expect(screen.getByText("Expenditure")).toBeInTheDocument();
    expect(screen.getByText("Reports")).toBeInTheDocument();

    // Legacy metric list + executive table still render for this role.
    expect(screen.getByText("Sales Value")).toBeInTheDocument();
    expect(screen.getByText("Anika Sharma")).toBeInTheDocument();
    expect(screen.queryByText("Active Executives")).not.toBeInTheDocument();
  });

  test("Accountant with no executives hides the performance table", () => {
    render(
      <DashboardExperience
        role="ACCOUNTANT"
        dashboardData={{ metrics: dashboardData.metrics, executivePerformance: [] }}
      />,
    );
    // Legacy cards still show, but the performance table is omitted (empty branch).
    expect(screen.getByText("Sales Value")).toBeInTheDocument();
    expect(screen.queryByText("Sales Executive Performance")).not.toBeInTheDocument();
  });
});
