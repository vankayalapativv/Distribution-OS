import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, renderHook } from "@testing-library/react";
import { useTodayBeat } from "./use-today-beat";

const fetchTodayBeat = vi.fn<(...a: unknown[]) => Promise<unknown>>(() => Promise.resolve({ beatPlanId: "b1", stops: [] }));
vi.mock("expo-router", () => ({ useFocusEffect: (cb: () => void) => React.useEffect(() => cb(), [cb]) }));
vi.mock("../auth", () => ({ useAuth: (sel: (s: { token: string }) => unknown) => sel({ token: "tok" }) }));
vi.mock("./today-beat-online", () => ({ fetchTodayBeat: (...a: unknown[]) => fetchTodayBeat(...a) }));

beforeEach(() => { fetchTodayBeat.mockResolvedValue({ beatPlanId: "b1", stops: [] }); });
afterEach(() => vi.clearAllMocks());

describe("useTodayBeat", () => {
  it("loads today's beat on focus and clears loading", async () => {
    const { result } = renderHook(() => useTodayBeat());
    await act(async () => { await Promise.resolve(); });
    expect(fetchTodayBeat).toHaveBeenCalledWith("tok");
    expect(result.current.beat).toEqual({ beatPlanId: "b1", stops: [] });
    expect(result.current.loading).toBe(false);
  });

  it("keeps the last beat and still clears loading when the fetch fails", async () => {
    fetchTodayBeat.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useTodayBeat());
    await act(async () => { await Promise.resolve(); });
    expect(result.current.beat).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("refresh re-fetches on demand", async () => {
    const { result } = renderHook(() => useTodayBeat());
    await act(async () => { await Promise.resolve(); });
    fetchTodayBeat.mockClear();
    await act(async () => { await result.current.refresh(); });
    expect(fetchTodayBeat).toHaveBeenCalledTimes(1);
  });

  it("does not set state after the screen unmounts", async () => {
    let release!: () => void;
    fetchTodayBeat.mockReturnValue(new Promise((r) => { release = () => r({ beatPlanId: "late", stops: [] }); }));
    const { result, unmount } = renderHook(() => useTodayBeat());
    unmount();
    await act(async () => { release(); await Promise.resolve(); });
    expect(result.current.beat).toBeNull(); // guarded setState after unmount
  });
});
