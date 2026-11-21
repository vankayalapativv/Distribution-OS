import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useRangeAutoClose } from "./use-range-auto-close";

const d = (s: string) => new Date(s);

describe("useRangeAutoClose", () => {
  it("applies each click but closes only on the second (end) pick", () => {
    const apply = vi.fn();
    const { result } = renderHook(() => useRangeAutoClose(apply));
    act(() => result.current.onOpenChange(true));
    expect(result.current.open).toBe(true);

    const first = { from: d("2026-08-01"), to: d("2026-08-01") }; // rdp same-day on first click
    act(() => result.current.onSelect(first));
    expect(apply).toHaveBeenCalledWith(first);
    expect(result.current.open).toBe(true); // first click keeps it open

    const full = { from: d("2026-08-01"), to: d("2026-08-05") };
    act(() => result.current.onSelect(full));
    expect(apply).toHaveBeenCalledTimes(2);
    expect(result.current.open).toBe(false); // end click closes
  });

  it("applies but does not advance on an empty selection", () => {
    const apply = vi.fn();
    const { result } = renderHook(() => useRangeAutoClose(apply));
    act(() => result.current.onOpenChange(true));
    act(() => result.current.onSelect(undefined)); // no from → apply, then early return
    expect(apply).toHaveBeenCalledWith(undefined);
    expect(result.current.open).toBe(true);
  });

  it("onOpenChange(false) just closes without resetting phase", () => {
    const { result } = renderHook(() => useRangeAutoClose(vi.fn()));
    act(() => result.current.onOpenChange(false));
    expect(result.current.open).toBe(false);
  });
});
