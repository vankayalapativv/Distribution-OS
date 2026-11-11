import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useLedgerCalendar } from "./use-ledger-calendar";

const setup = () => {
  const onCalendar = vi.fn();
  const onOpenChange = vi.fn();
  const { result } = renderHook(() => useLedgerCalendar({ onCalendar, onOpenChange }));
  return { result, onCalendar, onOpenChange };
};

describe("useLedgerCalendar", () => {
  it("commits and closes only on the second pick", () => {
    const { result, onCalendar, onOpenChange } = setup();

    act(() => result.current.handleSelect({ from: new Date(), to: new Date() }));
    expect(onCalendar).not.toHaveBeenCalled(); // first click: start only

    const range = { from: new Date("2026-06-01"), to: new Date("2026-06-10") };
    act(() => result.current.handleSelect(range));
    expect(onCalendar).toHaveBeenCalledWith(range);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("resets the pick phase when reopened and ignores a focus-out dismissal", () => {
    const { result, onOpenChange } = setup();

    act(() => result.current.handleOpenChange(true));
    expect(onOpenChange).toHaveBeenCalledWith(true);

    // focus-out while open is ignored (no close)
    onOpenChange.mockClear();
    act(() => result.current.handleOpenChange(false, { reason: "focus-out" }));
    expect(onOpenChange).not.toHaveBeenCalled();

    // a real close (escape/outside) still propagates
    act(() => result.current.handleOpenChange(false, { reason: "escape-key" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
