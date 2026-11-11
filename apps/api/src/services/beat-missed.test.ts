import { afterEach, describe, expect, it, vi } from "vitest";
import { markMissedBeatStops } from "./beat-missed";
import { makeSql, calledTag } from "../test/sql-mock";

// IST = UTC+5:30. 8 PM IST (the day-end cutoff) is 14:30 UTC.
const BEFORE_CUTOFF = new Date("2026-06-01T04:30:00Z"); // 10:00 IST
const AFTER_CUTOFF = new Date("2026-06-01T15:30:00Z"); // 21:00 IST

afterEach(() => vi.useRealTimers());

describe("markMissedBeatStops", () => {
  it("is a no-op before the 8 PM IST cutoff (no query, returns 0)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(BEFORE_CUTOFF);
    const sql = makeSql({ mark_missed_beat_stops: [{ id: "x" }] });
    expect(await markMissedBeatStops(sql)).toBe(0);
    expect(calledTag(sql, "mark_missed_beat_stops")).toBe(false);
  });

  it("flips still-pending stops to missed after the cutoff and returns the count", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(AFTER_CUTOFF);
    const sql = makeSql({ mark_missed_beat_stops: [{ id: "a" }, { id: "b" }, { id: "c" }] });
    expect(await markMissedBeatStops(sql)).toBe(3);
    expect(calledTag(sql, "mark_missed_beat_stops")).toBe(true);
  });

  it("returns 0 after the cutoff when nothing was pending", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(AFTER_CUTOFF);
    const sql = makeSql({ mark_missed_beat_stops: [] });
    expect(await markMissedBeatStops(sql)).toBe(0);
  });
});
