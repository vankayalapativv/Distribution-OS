import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildFeed,
  missedForPage,
  pageCountOf,
  presetRange,
  productivityPct,
  tsOf,
  whenParts,
  type MissedRow,
  type VisitRow,
  type VisitsData,
} from "./customer-visits-logic";

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

describe("pageCountOf / productivityPct", () => {
  it("computes page count (min 1) and productivity %", () => {
    expect(pageCountOf(0)).toBe(1);
    expect(pageCountOf(9)).toBe(2);
    expect(productivityPct(undefined)).toBeNull();
    expect(productivityPct({ total: 0, productive: 0 } as VisitsData)).toBeNull();
    expect(productivityPct({ total: 4, productive: 3 } as VisitsData)).toBe(75);
  });
});

describe("missedForPage", () => {
  it("places a missed row on the page implied by its newer count (clamped)", () => {
    const rows: MissedRow[] = [
      { date: "d1", at: null, executiveName: "A", newer: 0 }, // page 1
      { date: "d2", at: null, executiveName: "A", newer: 8 }, // page 2
      { date: "d3", at: null, executiveName: "A", newer: 999 }, // clamped to last page
    ];
    expect(missedForPage(rows, 2, 1).map((m) => m.date)).toEqual(["d1"]);
    expect(missedForPage(rows, 2, 2).map((m) => m.date)).toEqual(["d2", "d3"]);
  });
});

describe("buildFeed", () => {
  it("merges visits + missed rows newest-first", () => {
    const rows = [{ id: "v1", checkInTime: "2026-07-02T10:00:00", visitDate: null } as VisitRow];
    const missed: MissedRow[] = [{ date: "2026-07-03", at: "2026-07-03T19:00:00", executiveName: "A", newer: 0 }];
    const feed = buildFeed(rows, missed);
    expect(feed[0].kind).toBe("missed"); // 3rd is newer than 2nd
    expect(feed[1].kind).toBe("visit");
  });
});
