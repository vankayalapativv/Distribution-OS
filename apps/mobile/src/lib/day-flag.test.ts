import { describe, expect, test } from "vitest";
import { dayFlagIsForToday, istDate } from "./day-flag";

describe("istDate", () => {
  test("formats an IST calendar date as yyyy-mm-dd", () => {
    // 2026-07-28 09:00 IST (03:30 UTC)
    expect(istDate(Date.UTC(2026, 6, 28, 3, 30))).toBe("2026-07-28");
  });

  test("rolls to the next IST day for a late-night UTC timestamp", () => {
    // 2026-07-27 20:00 UTC = 2026-07-28 01:30 IST → the IST date is the 28th.
    expect(istDate(Date.UTC(2026, 6, 27, 20, 0))).toBe("2026-07-28");
  });
});

describe("dayFlagIsForToday — the stale 'Day is on' bug", () => {
  const today = "2026-07-28";

  test("today's date is valid → tracking is on", () => {
    expect(dayFlagIsForToday("2026-07-28", today)).toBe(true);
  });

  test("a previous day's date is stale → not on", () => {
    expect(dayFlagIsForToday("2026-07-27", today)).toBe(false);
  });

  test("the legacy '1' value is stale → not on (self-heals after update)", () => {
    expect(dayFlagIsForToday("1", today)).toBe(false);
  });

  test("no flag → not on", () => {
    expect(dayFlagIsForToday(null, today)).toBe(false);
  });
});
