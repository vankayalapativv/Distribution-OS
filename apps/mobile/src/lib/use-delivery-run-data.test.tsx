import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDeliveryRunData } from "./use-delivery-run-data";

const getLocalDb = vi.fn<() => unknown>();
const getActiveDeliveryRun = vi.fn();
const getDeliveryStops = vi.fn();
vi.mock("./db", () => ({ getLocalDb: () => getLocalDb() }));
vi.mock("./sync-core", () => ({
  getActiveDeliveryRun: (...a: unknown[]) => getActiveDeliveryRun(...a),
  getDeliveryStops: (...a: unknown[]) => getDeliveryStops(...a),
}));
vi.mock("./use-pull-refresh", () => ({
  usePullRefresh: (fn: () => Promise<void>) => ({ refreshing: false, onRefresh: fn }),
}));

afterEach(() => vi.clearAllMocks());

describe("useDeliveryRunData", () => {
  it("clears everything when there is no local db", () => {
    getLocalDb.mockReturnValue(null);
    const { result } = renderHook(() => useDeliveryRunData());
    act(() => result.current.reload());
    expect(result.current.active).toBeNull();
    expect(result.current.stops).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("loads the active run and its stops", () => {
    const run = { clientUuid: "r1", status: "active" };
    getLocalDb.mockReturnValue({ id: "db" });
    getActiveDeliveryRun.mockReturnValue(run);
    getDeliveryStops.mockReturnValue([{ clientUuid: "s1" }]);
    const { result } = renderHook(() => useDeliveryRunData());
    act(() => result.current.reload());
    expect(result.current.active).toBe(run);
    expect(result.current.stops).toEqual([{ clientUuid: "s1" }]);
    expect(getDeliveryStops).toHaveBeenCalledWith({ id: "db" }, "r1");
  });

  it("loads no stops when there is no active run", () => {
    getLocalDb.mockReturnValue({ id: "db" });
    getActiveDeliveryRun.mockReturnValue(null);
    const { result } = renderHook(() => useDeliveryRunData());
    act(() => result.current.reload());
    expect(result.current.active).toBeNull();
    expect(result.current.stops).toEqual([]);
    expect(getDeliveryStops).not.toHaveBeenCalled();
  });

  it("onRefresh re-reads the local db", async () => {
    getLocalDb.mockReturnValue({ id: "db" });
    getActiveDeliveryRun.mockReturnValue(null);
    const { result } = renderHook(() => useDeliveryRunData());
    await act(async () => { await result.current.onRefresh(); });
    expect(getActiveDeliveryRun).toHaveBeenCalled();
  });
});
