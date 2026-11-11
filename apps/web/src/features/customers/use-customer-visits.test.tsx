import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn(async (..._a: unknown[]) => visitsData);
vi.mock("@/lib/api-client", () => ({ apiGet: (...a: unknown[]) => apiGet(...a) }));
vi.mock("@/lib/productivity", () => ({ productivityColor: (pct: number) => ({ bg: "#0", fg: "#f", pct }) }));

import { useCustomerVisits } from "./use-customer-visits";

const visitsData = {
  summary: { today: 1, week: 2, month: 3, all: 4 },
  rows: [{ id: "v1", checkInTime: "2026-07-02T10:00:00", visitDate: null, executiveName: "A", type: "planned", orders: [], collections: [], marketIntelCount: 0 }],
  total: 4,
  productive: 3,
  page: 1,
  pageSize: 8,
  missedRows: [{ date: "2026-07-03", at: "2026-07-03T19:00:00", executiveName: "A", newer: 0 }],
};
const cfg = { apiBaseUrl: "x", authToken: "t" };
const wrap = (qc: QueryClient) => ({ children }: { readonly children: ReactNode }) =>
  createElement(QueryClientProvider, { client: qc }, children);
const setup = () =>
  renderHook(() => useCustomerVisits("c1", cfg), {
    wrapper: wrap(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
  });

afterEach(() => apiGet.mockClear());

describe("useCustomerVisits", () => {
  it("loads visits and derives the feed, productivity pill and page count", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(result.current.summary.all).toBe(4);
    expect(result.current.pct).toBe(75);
    expect(result.current.pill).toEqual({ bg: "#0", fg: "#f", pct: 75 });
    expect(result.current.pageCount).toBe(1);
    expect(result.current.feed).toHaveLength(2); // 1 visit + 1 missed
  });

  it("applies a preset range and requests it", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.data).toBeTruthy());
    act(() => result.current.applyPreset("month"));
    expect(result.current.preset).toBe("month");
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith(cfg, expect.stringContaining("from=")));
  });

  it("commits a custom range only on the second calendar click and manages the popover phase", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.data).toBeTruthy());
    act(() => result.current.onCalOpenChange(true));
    act(() => result.current.onCalendar({ from: new Date("2026-06-01"), to: new Date("2026-06-10") }));
    expect(result.current.preset).toBe("custom");
    expect(result.current.range).toEqual({ from: "2026-06-01", to: "2026-06-10" });
    // second pick closes the popover
    act(() => result.current.onCalendar({ from: new Date("2026-06-05"), to: undefined }));
    expect(result.current.calOpen).toBe(false);
    // a call with no from is a no-op
    act(() => result.current.onCalendar(undefined));
    expect(result.current.preset).toBe("custom");
    // closing the popover goes through onCalOpenChange(false)
    act(() => result.current.onCalOpenChange(false));
    expect(result.current.calOpen).toBe(false);
  });

  it("paginates via setPage", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.data).toBeTruthy());
    act(() => result.current.setPage((p) => p + 1));
    expect(result.current.page).toBe(2);
  });
});
