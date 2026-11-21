import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Controllable URL mock: useSearchParams reads `sp`; push/replace record the URL.
let sp = new URLSearchParams();
const replace = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => sp,
  useRouter: () => ({ push, replace }),
  usePathname: () => "/",
}));

import { usePeriodRange } from "./use-period-range";

const initial = { from: "2026-09-15", to: "2026-09-15" };

beforeEach(() => {
  sp = new URLSearchParams();
  replace.mockClear();
  push.mockClear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-15T10:00:00+05:30"));
});
afterEach(() => vi.useRealTimers());

describe("usePeriodRange — custom range + calendar", () => {
  it("derives a custom range from ?period=custom&from=&to=", () => {
    sp = new URLSearchParams("period=custom&from=2026-08-01&to=2026-08-31");
    const { result } = renderHook(() => usePeriodRange(initial));
    expect(result.current.preset).toBe("custom");
    expect(result.current.range).toEqual({ from: "2026-08-01", to: "2026-08-31" });
  });

  it("keeps the initial range for ?period=custom with no from/to yet", () => {
    sp = new URLSearchParams("period=custom"); // from && to is false → initialRange
    const { result } = renderHook(() => usePeriodRange(initial));
    expect(result.current.range).toEqual(initial);
  });

  it("applyCalendar with only a 'from' uses it for 'to' as well", () => {
    const { result } = renderHook(() => usePeriodRange(initial));
    act(() => result.current.applyCalendar({ from: new Date("2026-08-01T10:00:00+05:30"), to: undefined }));
    expect(replace).toHaveBeenCalledWith("/?period=custom&from=2026-08-01&to=2026-08-01", { scroll: false });
  });

  it("applyCalendar writes a custom range to the URL", () => {
    const { result } = renderHook(() => usePeriodRange(initial));
    act(() =>
      result.current.applyCalendar({
        from: new Date("2026-08-01T10:00:00+05:30"),
        to: new Date("2026-08-31T10:00:00+05:30"),
      }),
    );
    expect(replace).toHaveBeenCalledWith("/?period=custom&from=2026-08-01&to=2026-08-31", { scroll: false });
  });

  it("applyCalendar with no selection writes nothing", () => {
    const { result } = renderHook(() => usePeriodRange(initial));
    act(() => result.current.applyCalendar(undefined));
    expect(replace).not.toHaveBeenCalled();
  });

  it("setCalOpen toggles the calendar popover (local UI state)", () => {
    const { result } = renderHook(() => usePeriodRange(initial));
    act(() => result.current.setCalOpen(true));
    expect(result.current.calOpen).toBe(true);
  });
});
