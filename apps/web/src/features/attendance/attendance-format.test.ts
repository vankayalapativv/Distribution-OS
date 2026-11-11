import { describe, expect, it } from "vitest";
import { dayLabel, istTime, thisMonth, todayYmd } from "./attendance-format";

describe("todayYmd / thisMonth", () => {
  it("returns an IST YYYY-MM-DD and its YYYY-MM prefix", () => {
    const ymd = todayYmd();
    expect(ymd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(thisMonth()).toBe(ymd.slice(0, 7));
  });
});

describe("istTime", () => {
  it("is empty for null/undefined/empty", () => {
    expect(istTime(null)).toBe("");
    expect(istTime(undefined)).toBe("");
    expect(istTime("")).toBe("");
  });
  it("formats an ISO timestamp as lowercase IST clock time", () => {
    // 05:21 UTC = 10:51 IST.
    expect(istTime("2026-07-28T05:21:00Z")).toBe("10:51 am");
    // 10:00 UTC = 15:30 IST → 3:30 pm.
    expect(istTime("2026-07-28T10:00:00Z")).toBe("3:30 pm");
  });
});

describe("dayLabel", () => {
  it("renders short weekday + day + month in IST", () => {
    expect(dayLabel("2026-07-28")).toBe("Tue, 28 Jul");
  });
});
