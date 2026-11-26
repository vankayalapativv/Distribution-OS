import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchFulfillmentSummary } from "./admin-fulfillment";
import { fetchDashboardMetrics, istToday as dashToday } from "./admin-dashboard";
import { fetchMetricAgents, METRIC_META } from "./admin-drill";

const apiFetch = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve({}));
vi.mock("./api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("./auth", () => ({ useAuth: { getState: () => ({ token: "tok" }) } }));
afterEach(() => vi.clearAllMocks());

describe("fetchFulfillmentSummary", () => {
  it("returns the summary from the envelope", async () => {
    apiFetch.mockResolvedValue({ summary: { ordered: 5, delivered: 2 } });
    expect(await fetchFulfillmentSummary()).toEqual({ ordered: 5, delivered: 2 });
    expect(apiFetch).toHaveBeenCalledWith("/orders/fulfillment-summary", { token: "tok" });
  });
});

describe("fetchDashboardMetrics", () => {
  it("adds the from/to query when a range is given", async () => {
    apiFetch.mockResolvedValue({ visits: 3 });
    await fetchDashboardMetrics("2026-11-01", "2026-11-27");
    expect(apiFetch).toHaveBeenCalledWith("/dashboard/metrics?from=2026-11-01&to=2026-11-27", { token: "tok" });
  });
  it("omits the query for today (no range)", async () => {
    apiFetch.mockResolvedValue({});
    await fetchDashboardMetrics();
    expect(apiFetch).toHaveBeenCalledWith("/dashboard/metrics", { token: "tok" });
  });
  it("istToday returns an ISO yyyy-mm-dd date", () => {
    expect(dashToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("admin-drill METRIC_META rows", () => {
  it("renders each metric's row", () => {
    expect(METRIC_META.executives.row({ agentId: "a", agentName: "A", live: true, visits: 3 })).toEqual({ value: "Live", sub: "3 visits", tone: "live" });
    expect(METRIC_META.executives.row({ agentId: "a", agentName: "A", live: false })).toMatchObject({ value: "Offline", tone: "muted" });
    expect(METRIC_META.productivity.row({ agentId: "a", agentName: "A", productiveVisits: 4, visits: 6, customers: 5 })).toEqual({ value: "4/6", sub: "5 customers" });
    expect(METRIC_META.ordered.row({ agentId: "a", agentName: "A", litres: 120, orders: 3 })).toEqual({ value: "120 L", sub: "3 orders" });
    expect(METRIC_META.litres.row({ agentId: "a", agentName: "A", litres: 80, orders: 2 })).toEqual({ value: "80 L", sub: "2 deliveries" });
    expect(METRIC_META.collections.row({ agentId: "a", agentName: "A", amount: 5000, collections: 4 })).toEqual({ value: "₹5,000", sub: "4 entries" });
  });
  it("defaults missing numeric fields to 0", () => {
    expect(METRIC_META.ordered.row({ agentId: "a", agentName: "A" })).toEqual({ value: "0 L", sub: "0 orders" });
  });
});

describe("fetchMetricAgents", () => {
  it("fetches the per-agent breakdown for a metric + range", async () => {
    apiFetch.mockResolvedValue({ agents: [{ agentId: "a1", agentName: "Asha" }] });
    expect(await fetchMetricAgents("collections", "2026-11-01", "2026-11-27")).toEqual([{ agentId: "a1", agentName: "Asha" }]);
    expect(apiFetch).toHaveBeenCalledWith("/dashboard/metrics/collections/agents?from=2026-11-01&to=2026-11-27", { token: "tok" });
  });
});
