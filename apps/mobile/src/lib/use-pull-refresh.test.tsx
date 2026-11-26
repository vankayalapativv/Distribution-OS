import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePullRefresh } from "./use-pull-refresh";

afterEach(() => vi.clearAllMocks());

describe("usePullRefresh", () => {
  it("runs the latest fn and toggles the spinner around it", async () => {
    const fn = vi.fn<() => Promise<void>>(() => Promise.resolve());
    const { result, rerender } = renderHook((p: { fn: () => Promise<void> }) => usePullRefresh(p.fn), { initialProps: { fn } });
    expect(result.current.refreshing).toBe(false);
    const fn2 = vi.fn<() => Promise<void>>(() => Promise.resolve());
    rerender({ fn: fn2 }); // onRefresh is stable but calls the latest fn
    await act(async () => { await result.current.onRefresh(); });
    expect(fn).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalled();
    expect(result.current.refreshing).toBe(false);
  });

  it("swallows a failed refresh and still clears the spinner", async () => {
    const fn = vi.fn<() => Promise<void>>(() => Promise.reject(new Error("offline")));
    const { result } = renderHook(() => usePullRefresh(fn));
    await act(async () => { await result.current.onRefresh(); });
    expect(result.current.refreshing).toBe(false);
  });
});
