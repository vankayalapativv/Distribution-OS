import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../../lib/api", () => ({ apiFetch: vi.fn() }));
vi.mock("../../lib/auth", () => ({ useAuth: { getState: () => ({ token: "t" }) } }));

import { act, renderHook } from "@testing-library/react";
import { router } from "expo-router";
import { useTrackingMap } from "./use-tracking-map";

const props = () => ({
  visible: [],
  customers: [],
  checkins: [],
  bands: [],
  route: [],
  selectedId: null,
  setSelectedId: vi.fn(),
});

afterEach(() => vi.useRealTimers());

describe("useTrackingMap", () => {
  it("ignores a tap that resolves to no record", () => {
    const { result } = renderHook(() => useTrackingMap(props()));
    act(() => result.current.onMarkerTap({ lat: 0, lng: 0 } as never));
    expect(result.current.card).toBeNull();
  });

  it("openCustomer navigates and clears any open card", () => {
    (router.push as ReturnType<typeof vi.fn>).mockClear?.();
    const { result } = renderHook(() => useTrackingMap(props()));
    act(() => result.current.openCustomer("c9", "Zed"));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/customer/[id]", params: { id: "c9", name: "Zed" } });
  });

  it("reveals the map via the 10s safety timer", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTrackingMap(props()));
    expect(result.current.ready).toBe(false);
    act(() => vi.advanceTimersByTime(10_000));
    expect(result.current.ready).toBe(true);
  });
});
