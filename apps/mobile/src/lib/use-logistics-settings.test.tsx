import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, renderHook } from "@testing-library/react";
import { useLogisticsSettings } from "./use-logistics-settings";

const logout = vi.fn();
const confirm = vi.fn<(...a: unknown[]) => Promise<boolean>>(() => Promise.resolve(true));
const alert = vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve());
const getLocalDb = vi.fn<() => unknown>(() => ({}));
const getActiveDeliveryRun = vi.fn<(...a: unknown[]) => unknown>(() => null);

vi.mock("expo-router", () => ({ useFocusEffect: (cb: () => void) => React.useEffect(() => cb(), [cb]) }));
vi.mock("../components/dialog", () => ({ useDialog: () => ({ confirm: (...a: unknown[]) => confirm(...a), alert: (...a: unknown[]) => alert(...a) }) }));
vi.mock("./auth", () => ({ useAuth: () => ({ user: { role: "LOGISTICS" }, logout }) }));
vi.mock("./db", () => ({ getLocalDb: () => getLocalDb() }));
vi.mock("./sync-core", () => ({ getActiveDeliveryRun: (...a: unknown[]) => getActiveDeliveryRun(...a) }));

beforeEach(() => { getLocalDb.mockReturnValue({}); getActiveDeliveryRun.mockReturnValue(null); confirm.mockResolvedValue(true); });
afterEach(() => vi.clearAllMocks());

describe("useLogisticsSettings", () => {
  it("has no active run when none is open (or no db)", () => {
    expect(renderHook(() => useLogisticsSettings()).result.current.hasActiveRun).toBe(false);
    getLocalDb.mockReturnValue(null);
    expect(renderHook(() => useLogisticsSettings()).result.current.hasActiveRun).toBe(false);
  });
  it("flags an active run", () => {
    getActiveDeliveryRun.mockReturnValue({ id: "run-1" });
    expect(renderHook(() => useLogisticsSettings()).result.current.hasActiveRun).toBe(true);
  });
  it("blocks logout while a run is active", async () => {
    getActiveDeliveryRun.mockReturnValue({ id: "run-1" });
    const { result } = renderHook(() => useLogisticsSettings());
    await act(async () => { await result.current.onLogout(); });
    expect(alert).toHaveBeenCalledWith(expect.objectContaining({ title: "End your deliveries first" }));
    expect(logout).not.toHaveBeenCalled();
  });
  it("logs out on confirm when no run is active", async () => {
    const { result } = renderHook(() => useLogisticsSettings());
    await act(async () => { await result.current.onLogout(); });
    expect(logout).toHaveBeenCalled();
  });
  it("stays signed in when the logout is cancelled", async () => {
    confirm.mockResolvedValue(false);
    const { result } = renderHook(() => useLogisticsSettings());
    await act(async () => { await result.current.onLogout(); });
    expect(logout).not.toHaveBeenCalled();
  });
});
