import { describe, expect, it } from "vitest";
import { assemble, FAR_FUTURE, parseYmd, to12h, to24h, toYmd } from "./datetime-picker-utils";

describe("datetime-picker-utils", () => {
  it("toYmd zero-pads month and day", () => {
    expect(toYmd(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toYmd(new Date(2026, 10, 27))).toBe("2026-11-27");
  });

  it("parseYmd builds a local date with defaults", () => {
    expect(toYmd(parseYmd("2026-11-27"))).toBe("2026-11-27");
    expect(toYmd(parseYmd("2026"))).toBe("2026-01-01"); // missing month/day default to 1
  });

  it("to12h splits hour-24 into 12h + meridiem", () => {
    expect(to12h(0)).toEqual({ h: 12, ampm: "AM" });
    expect(to12h(6)).toEqual({ h: 6, ampm: "AM" });
    expect(to12h(12)).toEqual({ h: 12, ampm: "PM" });
    expect(to12h(18)).toEqual({ h: 6, ampm: "PM" });
  });

  it("to24h is the inverse", () => {
    expect(to24h(12, "AM")).toBe(0);
    expect(to24h(6, "AM")).toBe(6);
    expect(to24h(12, "PM")).toBe(12);
    expect(to24h(6, "PM")).toBe(18);
  });

  it("assemble combines the day and 12h time into one moment", () => {
    const d = assemble("2026-11-27", 9, 30, "PM");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getHours()).toBe(21);
    expect(d.getMinutes()).toBe(30);
  });

  it("FAR_FUTURE is a far-ahead yyyy-mm-dd string", () => {
    expect(FAR_FUTURE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(parseYmd(FAR_FUTURE).getTime()).toBeGreaterThan(Date.now());
  });
});
