import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { RunsSummary } from "./logistics-run-types";

const summary: RunsSummary = { runsToday: 6, activeNow: 2, stopsToday: 37, distanceKm: 612 };
vi.mock("@/lib/api-client", () => ({ apiGet: vi.fn(() => Promise.resolve(summary)) }));
import { apiGet } from "@/lib/api-client";
const apiGetMock = vi.mocked(apiGet);

import { LogisticsRunsSummary } from "./logistics-runs-summary";

const config = { apiBaseUrl: "", authToken: "" };
const wrap = (ui: React.ReactNode) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

describe("LogisticsRunsSummary", () => {
  it("shows the four totals once loaded", async () => {
    wrap(<LogisticsRunsSummary actionConfig={config} />);
    await waitFor(() => expect(screen.getByText("6")).toBeInTheDocument());
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("37")).toBeInTheDocument();
    expect(screen.getByText("612 km")).toBeInTheDocument();
    expect(screen.getByText("Runs today")).toBeInTheDocument();
    expect(screen.getByText("Active now")).toBeInTheDocument();
  });

  it("shows dashes while loading", () => {
    apiGetMock.mockReturnValueOnce(new Promise(() => {}));
    wrap(<LogisticsRunsSummary actionConfig={config} />);
    expect(screen.getAllByText("—").length).toBe(4);
  });
});
