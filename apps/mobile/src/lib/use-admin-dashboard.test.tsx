import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, renderHook } from "@testing-library/react";
import { useAdminDashboard } from "./use-admin-dashboard";

const fetchDashboardMetrics = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve({ visits: 3 }));
const istToday = vi.fn(() => "2026-11-27");
vi.mock("expo-router", () => ({ useFocusEffect: (cb: () => void) => React.useEffect(() => cb(), [cb]) }));
vi.mock("./admin-dashboard", () => ({
  fetchDashboardMetrics: (...a: unknown[]) => fetchDashboardMetrics(...a),
  istToday: () => istToday(),
}));

beforeEach(() => { fetchDashboardMetrics.mockResolvedValue({ visits: 3 }); istToday.mockReturnValue("2026-11-27"); });
afterEach(() => vi.clearAllMocks());

describe("useAdminDashboard", () => {
  it("loads today's metrics on focus", async () => {
    const { result } = renderHook(() => useAdminDashboard());
    await act(async () => { await Promise.resolve(); });
    expect(fetchDashboardMetrics).toHaveBeenCalledWith("2026-11-27", "2026-11-27");
    expect(result.current.metrics).toEqual({ visits: 3 });
    expect(result.current.isToday).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("captures the raw thrown value on failure", async () => {
    const err = new Error("500");
    fetchDashboardMetrics.mockRejectedValue(err);
    const { result } = renderHook(() => useAdminDashboard());
    await act(async () => { await Promise.resolve(); });
    expect(result.current.error).toBe(err);
    expect(result.current.metrics).toBeNull();
  });

  it("pull-to-refresh blanks metrics then reloads", async () => {
    const { result } = renderHook(() => useAdminDashboard());
    await act(async () => { await Promise.resolve(); });
    fetchDashboardMetrics.mockClear();
    await act(async () => { await result.current.onRefresh(); });
    expect(fetchDashboardMetrics).toHaveBeenCalled();
    expect(result.current.refreshing).toBe(false);
  });

  it("applyRange switches the range (no longer today) and reloads on focus", async () => {
    const { result } = renderHook(() => useAdminDashboard());
    await act(async () => { await Promise.resolve(); });
    act(() => result.current.applyRange("2026-10-01", "2026-10-31"));
    expect(result.current.metrics).toBeNull(); // blanked synchronously
    expect(result.current.isToday).toBe(false);
    await act(async () => { await Promise.resolve(); });
    expect(fetchDashboardMetrics).toHaveBeenCalledWith("2026-10-01", "2026-10-31");
  });
});
