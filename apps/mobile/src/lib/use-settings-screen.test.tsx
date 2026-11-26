import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, renderHook } from "@testing-library/react";
import { useSettingsScreen } from "./use-settings-screen";

const logout = vi.fn();
const confirm = vi.fn<(...a: unknown[]) => Promise<boolean>>(() => Promise.resolve(true));
const getLocalDb = vi.fn<() => unknown>(() => ({}));
const getFailedItems = vi.fn<(...a: unknown[]) => { id: string }[]>(() => [{ id: "f1" }]);
const h = vi.hoisted(() => {
  const syncState = { refreshStats: vi.fn(), retryFailed: vi.fn(), pending: 0, failed: 1 };
  const useSyncStore = Object.assign(
    (sel?: (s: typeof syncState) => unknown) => (sel ? sel(syncState) : syncState),
    { getState: () => syncState },
  );
  return { syncState, useSyncStore };
});

vi.mock("expo-router", () => ({ useFocusEffect: (cb: () => void) => React.useEffect(() => cb(), [cb]) }));
vi.mock("../components/dialog", () => ({ useDialog: () => ({ confirm: (...a: unknown[]) => confirm(...a) }) }));
let authUser: { role: string } | null = { role: "SALES_EXECUTIVE" };
vi.mock("./auth", () => ({ useAuth: () => ({ user: authUser, logout }) }));
vi.mock("./db", () => ({ getLocalDb: () => getLocalDb() }));
vi.mock("./sync-core", () => ({ getFailedItems: (...a: unknown[]) => getFailedItems(...a) }));
vi.mock("./sync", () => ({ useSyncStore: h.useSyncStore }));

beforeEach(() => { authUser = { role: "SALES_EXECUTIVE" }; getLocalDb.mockReturnValue({}); getFailedItems.mockReturnValue([{ id: "f1" }]); confirm.mockResolvedValue(true); });
afterEach(() => vi.clearAllMocks());

describe("useSettingsScreen", () => {
  it("loads failed items and refreshes sync stats on focus", () => {
    const { result } = renderHook(() => useSettingsScreen());
    expect(result.current.failedItems).toEqual([{ id: "f1" }]);
    expect(h.syncState.refreshStats).toHaveBeenCalled();
    expect(result.current.roleLabel).toBe("Sales Executive");
  });
  it("has a blank role label without a user", () => {
    authUser = null;
    expect(renderHook(() => useSettingsScreen()).result.current.roleLabel).toBe("");
  });
  it("shows no failed items without a local db", () => {
    getLocalDb.mockReturnValue(null);
    const { result } = renderHook(() => useSettingsScreen());
    expect(result.current.failedItems).toEqual([]);
  });
  it("retryFailed re-runs the queue and reloads the list", () => {
    const { result } = renderHook(() => useSettingsScreen());
    getFailedItems.mockReturnValue([]);
    act(() => result.current.retryFailed());
    expect(h.syncState.retryFailed).toHaveBeenCalled();
    expect(result.current.failedItems).toEqual([]);
  });
  it("retryFailed with no db yields an empty list", () => {
    const { result } = renderHook(() => useSettingsScreen());
    getLocalDb.mockReturnValue(null);
    act(() => result.current.retryFailed());
    expect(result.current.failedItems).toEqual([]);
  });
  it("logs out on confirm, stays on cancel", async () => {
    const { result } = renderHook(() => useSettingsScreen());
    await act(async () => { await result.current.onLogout(); });
    expect(logout).toHaveBeenCalled();
    confirm.mockResolvedValue(false);
    await act(async () => { await result.current.onLogout(); });
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
