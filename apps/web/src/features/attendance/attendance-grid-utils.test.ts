import { describe, expect, it } from "vitest";
import { monthDays, monthTitle, shiftDay, shiftMonth, weekdayInfo } from "./attendance-grid-utils";

describe("shiftMonth", () => {
  it("moves forward and back within a year", () => {
    expect(shiftMonth("2026-07", 1)).toBe("2026-08");
    expect(shiftMonth("2026-07", -1)).toBe("2026-06");
  });
  it("wraps across year boundaries", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});

describe("shiftDay", () => {
  it("moves a day forward and back", () => {
    expect(shiftDay("2026-07-28", 1)).toBe("2026-07-29");
    expect(shiftDay("2026-07-28", -1)).toBe("2026-07-27");
  });
  it("rolls across month and year boundaries", () => {
    expect(shiftDay("2026-07-31", 1)).toBe("2026-08-01");
    expect(shiftDay("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("monthDays", () => {
  it("lists every day of the month", () => {
    expect(monthDays("2026-02")).toHaveLength(28);
    const july = monthDays("2026-07");
    expect(july).toHaveLength(31);
    expect(july[0]).toBe("2026-07-01");
    expect(july[30]).toBe("2026-07-31");
  });
});

describe("monthTitle", () => {
  it("renders the long month + year", () => {
    expect(monthTitle("2026-07")).toBe("July 2026");
    expect(monthTitle("2026-01")).toBe("January 2026");
  });
});

describe("weekdayInfo", () => {
  it("returns the weekday initial and flags Sundays", () => {
    // 2026-07-26 is a Sunday (IST).
    expect(weekdayInfo("2026-07-26")).toEqual({ initial: "S", sunday: true });
    // 2026-07-27 is a Monday.
    const mon = weekdayInfo("2026-07-27");
    expect(mon.sunday).toBe(false);
    expect(mon.initial).toBe("M");
  });
});
