import { describe, expect, it } from "vitest";
import { dayFlagIsForToday, istDate, istHour } from "./day-flag";

describe("istDate", () => {
  it("formats a timestamp as the IST calendar date", () => {
    // 2026-11-26T20:00:00Z is 2026-11-27 01:30 IST → next day in IST.
    expect(istDate(Date.parse("2026-11-26T20:00:00Z"))).toBe("2026-11-27");
    expect(istDate(Date.parse("2026-11-27T05:00:00Z"))).toBe("2026-11-27");
  });
});

describe("dayFlagIsForToday", () => {
  it("is true only when the stored flag matches today's IST date", () => {
    expect(dayFlagIsForToday("2026-11-27", "2026-11-27")).toBe(true);
    expect(dayFlagIsForToday("2026-11-26", "2026-11-27")).toBe(false);
    expect(dayFlagIsForToday(null, "2026-11-27")).toBe(false);
    expect(dayFlagIsForToday("1", "2026-11-27")).toBe(false); // legacy value
  });
});

describe("istHour", () => {
  it("returns the IST hour of day (0-23)", () => {
    // 03:30 UTC = 09:00 IST
    expect(istHour(Date.parse("2026-11-27T03:30:00Z"))).toBe(9);
    // 18:30 UTC = 00:00 IST (next day) → 0, exercising the % 24 normalisation
    expect(istHour(Date.parse("2026-11-27T18:30:00Z"))).toBe(0);
    // 14:30 UTC = 20:00 IST (the 8 PM cutoff)
    expect(istHour(Date.parse("2026-11-27T14:30:00Z"))).toBe(20);
  });
});
