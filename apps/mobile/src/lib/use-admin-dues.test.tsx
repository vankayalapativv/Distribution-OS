import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useAdminDues } from "./use-admin-dues";

const fetchAdminDuesSummary = vi.fn();
const fetchAdminDuesCustomers = vi.fn();
const fetchSalesExecutives = vi.fn();
vi.mock("./admin-dues", () => ({
  fetchAdminDuesSummary: (...a: unknown[]) => fetchAdminDuesSummary(...a),
  fetchAdminDuesCustomers: (...a: unknown[]) => fetchAdminDuesCustomers(...a),
  fetchSalesExecutives: (...a: unknown[]) => fetchSalesExecutives(...a),
}));

let searchParams: { bucket?: string } = {};
vi.mock("expo-router", () => ({
  useLocalSearchParams: () => searchParams,
  // Run the focus callback like an effect so loads actually fire in tests.
  useFocusEffect: (cb: () => void) => React.useEffect(() => cb(), [cb]),
}));

const SUMMARY = {
  bands: [],
  buckets: [
    { key: "0", label: "0-30", fromDays: 0, toDays: 30, customers: 2, outstanding: 100 },
    { key: "1", label: "31+", fromDays: 31, toDays: null, customers: 1, outstanding: 50 },
  ],
  totalCustomers: 3,
  totalOutstanding: 150,
};

beforeEach(() => {
  searchParams = {};
  fetchSalesExecutives.mockResolvedValue([{ id: "e1", name: "Priya" }]);
  fetchAdminDuesSummary.mockResolvedValue(SUMMARY);
  fetchAdminDuesCustomers.mockResolvedValue({ bucket: "0", customers: [{ customerId: "c1" }] });
});
afterEach(() => vi.clearAllMocks());

describe("useAdminDues", () => {
  it("loads execs, summary and the first band's customers on focus", async () => {
    const { result } = renderHook(() => useAdminDues());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.execs).toEqual([{ id: "e1", name: "Priya" }]);
    expect(result.current.execsLoading).toBe(false);
    expect(result.current.buckets).toHaveLength(2);
    await waitFor(() => expect(result.current.bucket).toBe("0")); // reconciled from ""
    await waitFor(() => expect(result.current.customers).toEqual([{ customerId: "c1" }]));
    expect(result.current.listLoading).toBe(false);
  });

  it("honours a deep-linked ?bucket= that matches a band", async () => {
    searchParams = { bucket: "1" };
    const { result } = renderHook(() => useAdminDues());
    await waitFor(() => expect(result.current.bucket).toBe("1"));
    await waitFor(() => expect(fetchAdminDuesCustomers).toHaveBeenCalledWith("1", null));
  });

  it("captures a summary error for the UI to humanize", async () => {
    const boom = new Error("500");
    fetchAdminDuesSummary.mockRejectedValue(boom);
    const { result } = renderHook(() => useAdminDues());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(boom);
    expect(result.current.buckets).toEqual([]);
  });

  it("falls back to an empty customer list when the drill-down fails", async () => {
    fetchAdminDuesCustomers.mockRejectedValue(new Error("422"));
    const { result } = renderHook(() => useAdminDues());
    await waitFor(() => expect(result.current.listLoading).toBe(false));
    expect(result.current.customers).toEqual([]);
  });

  it("swallows a sales-executives fetch failure", async () => {
    fetchSalesExecutives.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useAdminDues());
    await waitFor(() => expect(result.current.execsLoading).toBe(false));
    expect(result.current.execs).toEqual([]);
  });

  it("reloads scoped to an executive when the filter changes", async () => {
    const { result } = renderHook(() => useAdminDues());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setExecId("e1"));
    await waitFor(() => expect(fetchAdminDuesSummary).toHaveBeenCalledWith("e1"));
  });

  it("onRefresh reloads the summary and the list", async () => {
    const { result } = renderHook(() => useAdminDues());
    await waitFor(() => expect(result.current.loading).toBe(false));
    fetchAdminDuesSummary.mockClear();
    fetchAdminDuesCustomers.mockClear();
    await act(async () => { await result.current.onRefresh(); });
    expect(fetchAdminDuesSummary).toHaveBeenCalled();
    expect(fetchAdminDuesCustomers).toHaveBeenCalled();
    expect(result.current.refreshing).toBe(false);
  });

  it("does not load customers while no band is selected (empty summary)", async () => {
    fetchAdminDuesSummary.mockResolvedValue({ ...SUMMARY, buckets: [] });
    const { result } = renderHook(() => useAdminDues());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.bucket).toBe("");
    expect(fetchAdminDuesCustomers).not.toHaveBeenCalled();
  });

  it("re-selects the tab when a new ?bucket= arrives", async () => {
    const { result, rerender } = renderHook(() => useAdminDues());
    await waitFor(() => expect(result.current.bucket).toBe("0"));
    searchParams = { bucket: "1" };
    rerender();
    await waitFor(() => expect(result.current.bucket).toBe("1"));
  });
});
