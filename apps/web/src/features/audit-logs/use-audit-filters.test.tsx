import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let sp = new URLSearchParams();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => sp,
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => "/audit-logs",
}));

import { useAuditFilters } from "./use-audit-filters";

beforeEach(() => { sp = new URLSearchParams(); replace.mockClear(); vi.useFakeTimers(); });
afterEach(() => vi.useRealTimers());

describe("useAuditFilters (URL-driven)", () => {
  it("debounces the search into the URL", () => {
    const { result } = renderHook(() => useAuditFilters());
    act(() => result.current.setSearch("  logi n "));
    expect(replace).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(350));
    expect(replace).toHaveBeenCalledWith("/audit-logs?q=logi+n", { scroll: false });
  });

  it("derives single-day and range dates from the URL", () => {
    sp = new URLSearchParams("from=2026-07-01");
    const { result: single } = renderHook(() => useAuditFilters());
    expect(single.current.fromDate).toBe("2026-07-01");
    expect(single.current.toDate).toBe("2026-07-01"); // single day → to = from server-side
    expect(single.current.dateLabel).toBe("01 Jul 2026");
    sp = new URLSearchParams("from=2026-07-01&to=2026-07-05");
    const { result: range } = renderHook(() => useAuditFilters());
    expect(range.current.toDate).toBe("2026-07-05");
    expect(range.current.dateLabel).toBe("01 Jul – 05 Jul 2026");
  });

  it("setDateRange writes from/to to the URL", () => {
    const { result } = renderHook(() => useAuditFilters());
    act(() => result.current.setDateRange({ from: new Date(2026, 6, 1), to: new Date(2026, 6, 5) }));
    expect(replace).toHaveBeenCalledWith("/audit-logs?from=2026-07-01&to=2026-07-05", { scroll: false });
  });

  it("empty URL yields blank dates + 'Any date' + no filters", () => {
    const { result } = renderHook(() => useAuditFilters());
    expect(result.current.fromDate).toBe("");
    expect(result.current.toDate).toBe("");
    expect(result.current.dateLabel).toBe("Any date");
    expect(result.current.hasFilters).toBe(false);
  });

  it("derives hasFilters from the URL; reset clears the URL", () => {
    sp = new URLSearchParams("actorId=u1");
    const { result } = renderHook(() => useAuditFilters());
    expect(result.current.hasFilters).toBe(true);
    act(() => result.current.reset());
    expect(replace).toHaveBeenCalledWith("/audit-logs", { scroll: false });
  });
});
