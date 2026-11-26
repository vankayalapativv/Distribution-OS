import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, renderHook } from "@testing-library/react";
import { useAdminTracking } from "./use-admin-tracking";
import type { TrackedExecutive } from "./admin-tracking";

const fetchTrackedExecutives = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve([]));
const fetchMapCustomers = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve({ customers: [], bands: [] }));
const fetchExecutiveRoute = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve([]));
const fetchCheckins = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve([]));
let pullFn: () => Promise<void> = async () => undefined;

vi.mock("expo-router", () => ({ useFocusEffect: (cb: () => void | (() => void)) => React.useEffect(cb, [cb]) }));
vi.mock("./admin-tracking", () => ({
  fetchTrackedExecutives: (...a: unknown[]) => fetchTrackedExecutives(...a),
  fetchMapCustomers: (...a: unknown[]) => fetchMapCustomers(...a),
  fetchExecutiveRoute: (...a: unknown[]) => fetchExecutiveRoute(...a),
  fetchCheckins: (...a: unknown[]) => fetchCheckins(...a),
  istToday: () => "2026-11-27",
}));
vi.mock("./use-pull-refresh", () => ({ usePullRefresh: (fn: () => Promise<void>) => { pullFn = fn; return { refreshing: false, onRefresh: fn }; } }));

const ex = (over: Partial<TrackedExecutive> = {}): TrackedExecutive => ({
  userId: "u1", name: "Asha", role: "SALES_EXECUTIVE", sessionStatus: "active",
  pointCount: 1, lastLatitude: 17, lastLongitude: 78, lastRecordedAt: null, ...over,
});
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  fetchTrackedExecutives.mockResolvedValue([ex()]);
  fetchMapCustomers.mockResolvedValue({ customers: [{ id: "c1" }], bands: [{ key: "0" }] });
  fetchExecutiveRoute.mockResolvedValue([{ latitude: 1, longitude: 2, recordedAt: "x" }]);
  fetchCheckins.mockResolvedValue([{ visitId: "v1" }]);
});
afterEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });

describe("useAdminTracking load", () => {
  it("loads execs + customers + bands on focus", async () => {
    const { result } = renderHook(() => useAdminTracking());
    await flush();
    expect(result.current.execs).toHaveLength(1);
    expect(result.current.customers).toEqual([{ id: "c1" }]);
    expect(result.current.bands).toEqual([{ key: "0" }]);
    expect(result.current.loading).toBe(false);
    expect(result.current.visible).toHaveLength(1); // has lat/lng
  });

  it("keeps the rep layer when the customer fetch fails", async () => {
    fetchMapCustomers.mockRejectedValue(new Error("map down"));
    const { result } = renderHook(() => useAdminTracking());
    await flush();
    expect(result.current.execs).toHaveLength(1);
    expect(result.current.customers).toEqual([]);
  });

  it("empties the reps when the executives fetch throws", async () => {
    fetchTrackedExecutives.mockRejectedValue(new Error("down"));
    const { result } = renderHook(() => useAdminTracking());
    await flush();
    expect(result.current.execs).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("drops reps without coordinates from the visible markers", async () => {
    fetchTrackedExecutives.mockResolvedValue([ex(), ex({ userId: "u2", lastLatitude: null, lastLongitude: null })]);
    const { result } = renderHook(() => useAdminTracking());
    await flush();
    expect(result.current.visible.map((e) => e.userId)).toEqual(["u1"]);
  });

  it("polls again on the 60s interval", async () => {
    vi.useFakeTimers();
    renderHook(() => useAdminTracking());
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    fetchTrackedExecutives.mockClear();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(fetchTrackedExecutives).toHaveBeenCalled();
  });
});

describe("useAdminTracking selection", () => {
  it("loads the route + check-ins for the selected rep, clearing routeStale", async () => {
    const { result } = renderHook(() => useAdminTracking());
    await flush();
    act(() => result.current.setSelectedId("u1"));
    await flush();
    expect(fetchExecutiveRoute).toHaveBeenCalledWith("u1", "2026-11-27");
    expect(result.current.route).toHaveLength(1);
    expect(result.current.checkins).toEqual([{ visitId: "v1" }]);
    expect(result.current.routeStale).toBe(false);
  });

  it("clears the route + check-ins when nobody is selected", async () => {
    const { result } = renderHook(() => useAdminTracking());
    await flush();
    act(() => result.current.setSelectedId("u1"));
    await flush();
    act(() => result.current.setSelectedId(null));
    await flush();
    expect(result.current.route).toEqual([]);
    expect(result.current.checkins).toEqual([]);
  });

  it("empties the check-ins on a fetch failure", async () => {
    fetchCheckins.mockRejectedValue(new Error("down"));
    const { result } = renderHook(() => useAdminTracking());
    await flush();
    act(() => result.current.setSelectedId("u1"));
    await flush();
    expect(result.current.checkins).toEqual([]);
  });

  it("pull-to-refresh reloads reps and the selected rep's route", async () => {
    const { result } = renderHook(() => useAdminTracking());
    await flush();
    act(() => result.current.setSelectedId("u1"));
    await flush();
    fetchExecutiveRoute.mockClear();
    await act(async () => { await pullFn(); });
    expect(fetchExecutiveRoute).toHaveBeenCalledWith("u1", "2026-11-27");
  });

  it("ignores a stale route fetch after the selection is cleared", async () => {
    let release!: (v: unknown) => void;
    fetchExecutiveRoute.mockReturnValue(new Promise((r) => { release = r; }));
    const { result } = renderHook(() => useAdminTracking());
    await flush();
    act(() => result.current.setSelectedId("u1")); // route fetch pending
    act(() => result.current.setSelectedId(null)); // cleanup → cancelled
    await act(async () => { release([{ latitude: 9, longitude: 9, recordedAt: "late" }]); await Promise.resolve(); });
    expect(result.current.route).toEqual([]); // stale resolve ignored
  });

  it("ignores a stale check-ins fetch (success + failure) after the selection is cleared", async () => {
    let release!: (v: unknown) => void;
    let reject!: (e: unknown) => void;
    fetchCheckins
      .mockReturnValueOnce(new Promise((r) => { release = r; }))
      .mockReturnValueOnce(new Promise((_r, rej) => { reject = rej; }));
    const { result } = renderHook(() => useAdminTracking());
    await flush();
    act(() => result.current.setSelectedId("u1")); // check-ins fetch #1 pending
    act(() => result.current.setSelectedId(null)); // cleanup → cancelled
    await act(async () => { release([{ visitId: "late" }]); await Promise.resolve(); });
    expect(result.current.checkins).toEqual([]);
    // Now the failure path: a pending fetch that rejects after cancel.
    act(() => result.current.setSelectedId("u2")); // check-ins fetch #2 pending
    act(() => result.current.setSelectedId(null));
    await act(async () => { reject(new Error("late")); await Promise.resolve(); });
    expect(result.current.checkins).toEqual([]);
  });

  it("pull-to-refresh with no selection only reloads reps", async () => {
    const { result } = renderHook(() => useAdminTracking());
    await flush();
    fetchExecutiveRoute.mockClear();
    await act(async () => { await pullFn(); });
    expect(fetchExecutiveRoute).not.toHaveBeenCalled();
    expect(result.current.date).toBe("2026-11-27");
  });
});
