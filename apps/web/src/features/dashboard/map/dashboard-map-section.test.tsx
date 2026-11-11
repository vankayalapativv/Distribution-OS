import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn();
vi.mock("@/lib/api-client", () => ({
  apiGet: (...a: unknown[]) => apiGet(...a),
  errorMessage: (e: unknown, fb: string) => (e instanceof Error ? e.message : fb),
}));
vi.mock("./use-in-viewport", () => ({ useInViewport: () => ({ ref: { current: null }, inView: true }) }));
vi.mock("@/features/tracking/tracking-map-loading", () => ({ MapLoadingOverlay: () => <div>loading-overlay</div> }));
// The dynamically-imported map — a stub that captures (does not auto-call) its
// render-complete callback so tests can drive reveal both ways.
let onRender: (() => void) | undefined;
vi.mock("./osm-map", () => ({
  OsmMap: (p: { onRenderComplete?: () => void }) => {
    onRender = p.onRenderComplete;
    return <div>osm-map</div>;
  },
}));

import { DashboardMapSection } from "./dashboard-map-section";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children);

afterEach(() => apiGet.mockReset());

describe("DashboardMapSection", () => {
  it("loads customers and reveals the map on render-complete", async () => {
    apiGet.mockResolvedValueOnce({ customers: [] });
    render(<DashboardMapSection actionConfig={cfg} />, { wrapper });
    expect(screen.getByText("Customers Map")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("osm-map")).toBeInTheDocument());
    act(() => onRender?.()); // OsmMap signals it finished painting → reveal
    expect(screen.getByText("osm-map")).toBeInTheDocument();
  });

  it("reveals the map via the safety timeout if render-complete never fires", async () => {
    vi.useFakeTimers();
    try {
      apiGet.mockResolvedValueOnce({ customers: [] });
      render(<DashboardMapSection actionConfig={cfg} />, { wrapper });
      await act(async () => { await vi.advanceTimersByTimeAsync(0); }); // resolve query + dynamic import
      await act(async () => { await vi.advanceTimersByTimeAsync(10_000); }); // fire the fallback
      expect(screen.getByText("osm-map")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows an error message when the map data fails", async () => {
    apiGet.mockRejectedValueOnce(new Error("map down"));
    render(<DashboardMapSection actionConfig={cfg} />, { wrapper });
    await waitFor(() => expect(screen.getByText("map down")).toBeInTheDocument());
  });
});
