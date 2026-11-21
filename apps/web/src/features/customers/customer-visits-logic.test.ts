import { afterEach, describe, expect, it, vi } from "vitest";
import { presetRange, timeRange, tsOf, whenParts } from "./customer-visits-logic";

afterEach(() => vi.useRealTimers());

describe("tsOf", () => {
  it("prefers the timestamp, falls back to the date, else 0", () => {
    expect(tsOf("2026-07-01T10:00:00.000Z", null)).toBe(new Date("2026-07-01T10:00:00.000Z").getTime());
    expect(tsOf(null, "2026-07-01")).toBe(new Date("2026-07-01T00:00:00").getTime());
    expect(tsOf(null, null)).toBe(0);
  });
});

describe("presetRange", () => {
  it("computes today/week/month and an open all-time range", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T09:00:00"));
    expect(presetRange("today")).toEqual({ from: "2026-06-15", to: "2026-06-15" });
    expect(presetRange("week")).toEqual({ from: "2026-06-15", to: "2026-06-15" }); // Mon 15th
    expect(presetRange("month")).toEqual({ from: "2026-06-01", to: "2026-06-15" });
    expect(presetRange("all")).toEqual({ from: null, to: null });
  });
});

describe("whenParts", () => {
  it("splits a timestamp into date + time, and a date-only into date + blank", () => {
    const w = whenParts("2026-07-01T14:30:00", null);
    expect(w.date).toContain("01 Jul 2026");
    expect(w.time).toBe("2:30 PM");
    expect(whenParts(null, "2026-07-01").time).toBe("");
    expect(whenParts(null, null)).toEqual({ date: "—", time: "" });
  });
});

describe("timeRange", () => {
  it("is blank without a check-in, the time alone, or a check-in → check-out range", () => {
    expect(timeRange(null, null)).toBe("");
    expect(timeRange("2026-07-01T10:00:00", null)).toBe("10:00 AM");
    expect(timeRange("2026-07-01T10:00:00", "2026-07-01T10:24:00")).toBe("10:00 AM → 10:24 AM");
  });
});
