import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("react-native", async (imp) => {
  const actual = (await imp()) as Record<string, unknown>;
  // rnw ScrollView injects the scroll content as RefreshControl's children, so
  // the stub must render them — plus a trigger for the local refresh handler.
  return {
    ...actual,
    RefreshControl: ({ onRefresh, children }: { onRefresh: () => void; children?: React.ReactNode }) => (
      <div>
        {children}
        <button type="button" onClick={onRefresh}>pull-refresh</button>
      </div>
    ),
  };
});

const useAdminDashboard = vi.fn();
vi.mock("../../lib/use-admin-dashboard", () => ({ useAdminDashboard: () => useAdminDashboard() }));
vi.mock("../../components/admin-dues-card", () => ({ AdminDuesCard: () => null }));
vi.mock("../../components/admin-se-dues-card", () => ({ AdminSeDuesCard: () => null }));
vi.mock("../../components/admin-fulfillment-card", () => ({ AdminFulfillmentCard: () => null }));
vi.mock("../../components/leaderboard-card", () => ({ LeaderboardCard: () => null }));
vi.mock("../../components/segment-sales-card", () => ({ SegmentSalesCard: () => null }));
vi.mock("../../components/home/admin-kpi-grid", () => ({ AdminKpiGrid: ({ metrics }: { metrics: unknown }) => <span>kpi-{metrics ? "data" : "skeleton"}</span> }));
vi.mock("../../components/date-range-sheet", () => ({
  rangeLabel: (f: string, t: string) => `${f}→${t}`,
  DateRangeSheet: ({ visible, onApply, onClose }: { visible: boolean; onApply: (f: string, t: string) => void; onClose: () => void }) =>
    visible ? (
      <div>
        <button type="button" onClick={() => onApply("2026-11-01", "2026-11-07")}>apply</button>
        <button type="button" onClick={onClose}>close-sheet</button>
      </div>
    ) : null,
}));

import AdminHomeScreen from "./index";

const base = {
  metrics: { total: 1 }, error: null, refreshing: false,
  range: { from: "2026-11-01", to: "2026-11-07" }, isToday: true,
  load: vi.fn(), onRefresh: vi.fn(), applyRange: vi.fn(),
};

describe("AdminHomeScreen", () => {
  it("renders KPI data, opens the range sheet, applies and closes it", () => {
    const applyRange = vi.fn();
    useAdminDashboard.mockReturnValue({ ...base, applyRange });
    render(<AdminHomeScreen />);
    expect(screen.getByText("kpi-data")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Today")); // open the sheet
    fireEvent.click(screen.getByText("apply"));
    expect(applyRange).toHaveBeenCalledWith("2026-11-01", "2026-11-07");
    fireEvent.click(screen.getByText("Today"));
    fireEvent.click(screen.getByText("close-sheet"));
  });

  it("shows the skeleton grid while loading and a custom range label", () => {
    useAdminDashboard.mockReturnValue({ ...base, metrics: null, isToday: false });
    render(<AdminHomeScreen />);
    expect(screen.getByText("kpi-skeleton")).toBeInTheDocument();
    expect(screen.getByText("2026-11-01→2026-11-07")).toBeInTheDocument();
  });

  it("shows a single error with retry when the whole dashboard fails", () => {
    const load = vi.fn();
    useAdminDashboard.mockReturnValue({ ...base, metrics: null, error: new Error("x"), load });
    render(<AdminHomeScreen />);
    fireEvent.click(screen.getByText("Try again"));
    expect(load).toHaveBeenCalled();
    expect(screen.queryByText(/kpi-/)).not.toBeInTheDocument();
  });

  it("drives pull-to-refresh", () => {
    const onRefresh = vi.fn();
    useAdminDashboard.mockReturnValue({ ...base, onRefresh });
    render(<AdminHomeScreen />);
    fireEvent.click(screen.getByText("pull-refresh"));
    expect(onRefresh).toHaveBeenCalled();
  });
});
