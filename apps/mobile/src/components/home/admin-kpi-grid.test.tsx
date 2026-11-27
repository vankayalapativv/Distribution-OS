import { describe, expect, it, vi } from "vitest";

const fetchMetricAgents = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve([]));
vi.mock("../../lib/api", () => ({ apiFetch: vi.fn() }));
vi.mock("../../lib/auth", () => ({ useAuth: () => ({ token: "t" }) }));
vi.mock("../../lib/admin-drill", async () => {
  const actual = await vi.importActual<typeof import("../../lib/admin-drill")>("../../lib/admin-drill");
  return { ...actual, fetchMetricAgents: (...a: unknown[]) => fetchMetricAgents(...a) };
});

import { beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdminKpiGrid } from "./admin-kpi-grid";
import type { DashboardMetrics } from "../../lib/admin-dashboard";

beforeEach(() => fetchMetricAgents.mockClear());

const metrics = {
  range: { from: "2026-11-01", to: "2026-11-27" },
  activeExecutives: { live: 3, total: 5 },
  visits: 10,
  productiveVisits: 7,
  sales: { litres: 100, orders: 4 },
  orderedOils: { litres: 200, orders: 8 },
  oilsByBrand: [],
  collections: { total: 1000, verified: 1000, pendingCount: 0, count: 2 },
} as DashboardMetrics;

const range = { from: "2026-11-01", to: "2026-11-27" };

describe("AdminKpiGrid", () => {
  it("renders the fixed cards and opens a drill-down on tap", async () => {
    render(<AdminKpiGrid metrics={metrics} range={range} />);
    expect(screen.getByText("Active Executives")).toBeInTheDocument();
    expect(screen.getByText("3/5")).toBeInTheDocument();
    // Tap the Active Executives card → drill dialog fetches that metric.
    fireEvent.click(screen.getByText("Active Executives"));
    await waitFor(() => expect(fetchMetricAgents).toHaveBeenCalledWith("executives", range.from, range.to));
    // The drill dialog opened (title "By executive"); closing it dismisses it.
    expect(await screen.findByText("By executive")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("close"));
    await waitFor(() => expect(screen.queryByText("By executive")).not.toBeInTheDocument());
  });

  it("renders shimmering cards (no drill) before metrics arrive", () => {
    render(<AdminKpiGrid metrics={null} range={range} />);
    fireEvent.click(screen.getByText("Active Executives"));
    // No metrics → open() returns undefined → no drill fetch.
    expect(fetchMetricAgents).not.toHaveBeenCalled();
  });
});
