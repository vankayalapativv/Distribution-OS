import { describe, expect, it } from "vitest";
import { MONTHS, WEEKDAYS, parseYmd, toYmd } from "./calendar-range-utils";

describe("calendar-range-utils", () => {
  it("has stable weekday keys and 12 month names", () => {
    expect(WEEKDAYS.map((w) => w.key)).toEqual(["sun", "mon", "tue", "wed", "thu", "fri", "sat"]);
    expect(MONTHS).toHaveLength(12);
    expect(MONTHS[0]).toBe("January");
  });

  it("parseYmd builds a local date (no UTC shift)", () => {
    const d = parseYmd("2026-11-27");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(10); // 0-indexed November
    expect(d.getDate()).toBe(27);
  });

  it("parseYmd defaults missing month/day to 1", () => {
    const d = parseYmd("2026");
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
  });

  it("toYmd zero-pads the month and day", () => {
    expect(toYmd(2026, 0, 5)).toBe("2026-01-05");
    expect(toYmd(2026, 10, 27)).toBe("2026-11-27");
  });
});
