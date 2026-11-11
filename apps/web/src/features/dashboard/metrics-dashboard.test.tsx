import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DashboardMetrics } from "./metrics-helpers";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
}));

const initial: DashboardMetrics = {
  range: { from: "2026-09-15", to: "2026-09-15" },
  activeExecutives: { live: 2, total: 6 },
  visits: 10, productiveVisits: 5,
  sales: { litres: 100, orders: 3 },
  orderedOils: { litres: 120, orders: 4 },
  oilsByBrand: [],
  collections: { total: 5000, verified: 2000, pendingCount: 0, count: 4 },
};

// Controllable metrics state + a spyable drilldown close. `drillState.metric` is
// mutable so a test can open a metric (which mounts the now lazily-loaded dialog).
const metricsState = { metrics: initial, loading: false, isPending: false, error: null as string | null };
const close = vi.fn();
const drillState = { metric: null as string | null, agents: [], agent: null, customerRows: [], error: null, openMetric: vi.fn(), close, back: vi.fn(), openAgent: vi.fn() };

vi.mock("./use-dashboard-metrics", () => ({ useDashboardMetrics: () => metricsState }));
// The hook now lives in its own module; the dialog (mocked below) is loaded via
// next/dynamic, so tests that need it await findByText.
vi.mock("./use-drilldown", () => ({ useDrilldown: () => drillState }));
vi.mock("./metrics-drilldown-dialog", () => ({
  MetricsDrilldownDialog: (p: { onOpenChange: (o: boolean) => void }) => (
    <>
      <button onClick={() => p.onOpenChange(false)}>close-drilldown</button>
      <button onClick={() => p.onOpenChange(true)}>open-drilldown</button>
    </>
  ),
}));
vi.mock("./dues-card", () => ({ DuesCard: () => <div>dues</div> }));
vi.mock("./map/dashboard-map-section", () => ({ DashboardMapSection: () => <div>map</div> }));

import { MetricsDashboard } from "./metrics-dashboard";

afterEach(() => {
  metricsState.isPending = false;
  metricsState.error = null;
  drillState.metric = null;
  close.mockClear();
});

describe("MetricsDashboard", () => {
  it("renders the metric cards, dues and map when loaded", () => {
    render(<MetricsDashboard actionConfig={{ apiBaseUrl: "x", authToken: "t" }} initialMetrics={initial} />);
    expect(screen.getByText("Active Executives")).toBeInTheDocument();
    expect(screen.getByText("dues")).toBeInTheDocument();
    expect(screen.getByText("map")).toBeInTheDocument();
  });

  it("shows the skeleton while pending", () => {
    metricsState.isPending = true;
    render(<MetricsDashboard actionConfig={{ apiBaseUrl: "x", authToken: "t" }} initialMetrics={initial} />);
    expect(screen.getByLabelText("Loading metrics")).toBeInTheDocument();
    expect(screen.queryByText("Active Executives")).not.toBeInTheDocument();
  });

  it("shows an error banner when the query errors", () => {
    metricsState.error = "Could not load metrics.";
    render(<MetricsDashboard actionConfig={{ apiBaseUrl: "x", authToken: "t" }} initialMetrics={initial} />);
    expect(screen.getByText("Could not load metrics.")).toBeInTheDocument();
  });

  it("closes the drilldown when its dialog requests close", async () => {
    drillState.metric = "visits"; // open a metric so the lazy dialog mounts
    render(<MetricsDashboard actionConfig={{ apiBaseUrl: "x", authToken: "t" }} initialMetrics={initial} />);
    fireEvent.click(await screen.findByText("close-drilldown")); // await the lazy chunk
    expect(close).toHaveBeenCalled();
  });

  it("does not close the drilldown when it is opening", async () => {
    drillState.metric = "visits";
    render(<MetricsDashboard actionConfig={{ apiBaseUrl: "x", authToken: "t" }} initialMetrics={initial} />);
    fireEvent.click(await screen.findByText("open-drilldown"));
    expect(close).not.toHaveBeenCalled();
  });
});
