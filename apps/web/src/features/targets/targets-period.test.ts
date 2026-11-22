import { describe, expect, it } from "vitest";
import { startOfMonth, startOfWeek } from "date-fns";
import { currentStartOf, MONDAY, periodLabel } from "./targets-period";

describe("periodLabel", () => {
  it("labels a week and a month", () => {
    const d = new Date(2026, 6, 6); // Mon 6 Jul 2026
    expect(periodLabel("week", d)).toBe("Week of 06 Jul 2026");
    expect(periodLabel("month", d)).toBe("July 2026");
  });
});

describe("currentStartOf", () => {
  it("returns this Monday for a week and the 1st for a month", () => {
    expect(currentStartOf("week").getTime()).toBe(startOfWeek(new Date(), MONDAY).getTime());
    expect(currentStartOf("month").getTime()).toBe(startOfMonth(new Date()).getTime());
  });
});
