import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { DashboardExperience, type DashboardExperienceData } from "./dashboard-experience";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
}));

const dashboardData: DashboardExperienceData = {
  metrics: [
    { label: "Sales Value", value: "185000" },
    { label: "Collections", value: "74000" },
    { label: "Productive Visits", value: "12" },
  ],
  executivePerformance: [
    { name: "Anika Sharma", visits: 8, productiveVisits: 6, salesValue: "92000", collections: "36000", gpsStatus: "active" },
  ],
};

describe("DashboardExperience (accountant)", () => {
  test("Accountant keeps the legacy cards (no live metrics prop)", () => {
    render(<DashboardExperience role="ACCOUNTANT" dashboardData={dashboardData} />);
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
      <DashboardExperience role="ACCOUNTANT" dashboardData={{ metrics: dashboardData.metrics, executivePerformance: [] }} />,
    );
    expect(screen.getByText("Sales Value")).toBeInTheDocument();
    expect(screen.queryByText("Sales Executive Performance")).not.toBeInTheDocument();
  });
});
