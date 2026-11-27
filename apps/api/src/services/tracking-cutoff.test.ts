import { describe, expect, test } from "vitest";
import { trackingCutoffHour, isAfterAllowedEndTime } from "./tracking-sessions";

describe("tracking cutoff (hard-coded: SE 8 PM, Logistics end of IST day)", () => {
  test("SE cutoff is 20, Logistics is 24, other roles have none", () => {
    expect(trackingCutoffHour("SALES_EXECUTIVE")).toBe(20);
    expect(trackingCutoffHour("LOGISTICS")).toBe(24);
    expect(trackingCutoffHour("SUPER_ADMIN")).toBeNull();
    expect(trackingCutoffHour(null)).toBeNull();
    expect(trackingCutoffHour(undefined)).toBeNull();
  });

  test("SE keeps points before 8 PM, drops points at/after it", () => {
    const base = { sessionDate: "2026-07-20", timezone: "Asia/Kolkata", cutoffHour: 20 };
    // 2026-07-20T10:00:00Z = 15:30 IST (before 20:00) → kept
    expect(isAfterAllowedEndTime({ ...base, recordedAt: "2026-07-20T10:00:00.000Z" })).toBe(false);
    // 2026-07-20T14:29:00Z = 19:59 IST (before 20:00) → kept
    expect(isAfterAllowedEndTime({ ...base, recordedAt: "2026-07-20T14:29:00.000Z" })).toBe(false);
    // 2026-07-20T14:30:00Z = 20:00 IST (at the stop hour) → dropped
    expect(isAfterAllowedEndTime({ ...base, recordedAt: "2026-07-20T14:30:00.000Z" })).toBe(true);
    // 2026-07-20T16:35:00Z = 22:05 IST (past the stop hour) → dropped
    expect(isAfterAllowedEndTime({ ...base, recordedAt: "2026-07-20T16:35:00.000Z" })).toBe(true);
  });

  test("SE drops points that spill into the NEXT IST day", () => {
    const base = { sessionDate: "2026-07-20", timezone: "Asia/Kolkata", cutoffHour: 20 };
    // 2026-07-20T18:35:00Z = 00:05 IST on 2026-07-21 → dropped
    expect(isAfterAllowedEndTime({ ...base, recordedAt: "2026-07-20T18:35:00.000Z" })).toBe(true);
    // 2026-07-21T05:00:00Z = 10:30 IST next day → dropped
    expect(isAfterAllowedEndTime({ ...base, recordedAt: "2026-07-21T05:00:00.000Z" })).toBe(true);
  });

  test("Logistics (cutoff 24) keeps every same-day hour, drops next-day points", () => {
    const base = { sessionDate: "2026-07-20", timezone: "Asia/Kolkata", cutoffHour: 24 };
    // 2026-07-20T16:35:00Z = 22:05 IST, still the start day → kept
    expect(isAfterAllowedEndTime({ ...base, recordedAt: "2026-07-20T16:35:00.000Z" })).toBe(false);
    // 2026-07-20T18:35:00Z = 00:05 IST on 2026-07-21 (next day) → dropped (auto-close at midnight)
    expect(isAfterAllowedEndTime({ ...base, recordedAt: "2026-07-20T18:35:00.000Z" })).toBe(true);
    expect(isAfterAllowedEndTime({ ...base, recordedAt: "2026-07-21T05:00:00.000Z" })).toBe(true);
  });

  test("null cutoff keeps points on any day (no auto-close)", () => {
    const base = { sessionDate: "2026-07-20", timezone: "Asia/Kolkata", cutoffHour: null };
    expect(isAfterAllowedEndTime({ ...base, recordedAt: "2026-07-20T15:35:00.000Z" })).toBe(false);
    expect(isAfterAllowedEndTime({ ...base, recordedAt: "2026-07-21T05:00:00.000Z" })).toBe(false);
  });
});
