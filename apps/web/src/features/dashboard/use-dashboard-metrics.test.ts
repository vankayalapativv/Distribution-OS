import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const apiGet = vi.fn();
vi.mock("@/lib/api-client", () => ({
  apiGet: (...a: unknown[]) => apiGet(...a),
  errorMessage: (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback),
}));

import { useDashboardMetrics } from "./use-dashboard-metrics";
import type { DashboardMetrics } from "./metrics-helpers";

const cfg = { apiBaseUrl: "http://api.test", authToken: "t" };
const initial: DashboardMetrics = {
  range: { from: "2026-09-15", to: "2026-09-15" },
  activeExecutives: { live: 2, total: 6 },
  visits: 10, productiveVisits: 5,
  sales: { litres: 100, orders: 3 },
  orderedOils: { litres: 120, orders: 4 },
  oilsByBrand: [],
  collections: { total: 5000, verified: 2000, pendingCount: 0, count: 4 },
};

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}

describe("useDashboardMetrics", () => {
  it("seeds from initialMetrics for the initial range (no pending)", () => {
    const { result } = renderHook(() => useDashboardMetrics(cfg, initial.range, initial), { wrapper });
    expect(result.current.isPending).toBe(false);
    expect(result.current.metrics).toEqual(initial);
    expect(result.current.error).toBeNull();
  });

  it("fetches for a non-initial range and returns the fetched data", async () => {
    const fetched = { ...initial, visits: 99 };
    apiGet.mockResolvedValueOnce(fetched);
    const { result } = renderHook(
      () => useDashboardMetrics(cfg, { from: "2026-08-01", to: "2026-08-31" }, initial),
      { wrapper },
    );
    expect(result.current.isPending).toBe(true); // no initialData for this range
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.metrics.visits).toBe(99);
  });

  it("surfaces an error message when the fetch fails", async () => {
    apiGet.mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(
      () => useDashboardMetrics(cfg, { from: "2026-07-01", to: "2026-07-31" }, initial),
      { wrapper },
    );
    await waitFor(() => expect(result.current.error).toBe("boom"));
    // Falls back to initialMetrics while errored.
    expect(result.current.metrics).toEqual(initial);
  });
});
