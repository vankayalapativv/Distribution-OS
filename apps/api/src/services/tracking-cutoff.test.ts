import { describe, expect, test } from "vitest";
import { trackingCutoffHour, isAfterAllowedEndTime } from "./tracking-sessions";

describe("tracking cutoff (SE end-of-IST-day; Logistics none)", () => {
  test("SE cutoff is end-of-day (hour 24); Logistics has none", () => {
    expect(trackingCutoffHour("SALES_EXECUTIVE")).toBe(24);
    expect(trackingCutoffHour("LOGISTICS")).toBeNull();
    // Unknown / other roles are treated like Logistics (no cutoff).
    expect(trackingCutoffHour(null)).toBeNull();
    expect(trackingCutoffHour(undefined)).toBeNull();
  });

  test("SE keeps every point within the start IST day, including late evening", () => {
    const base = { sessionDate: "2026-07-20", timezone: "Asia/Kolkata", cutoffHour: 24 };
    // 2026-07-20T10:00:00Z = 15:30 IST (same day) → kept
    expect(isAfterAllowedEndTime({ ...base, recordedAt: "2026-07-20T10:00:00.000Z" })).toBe(false);
    // 2026-07-20T15:35:00Z = 21:05 IST (same day, was past the OLD 8 PM cutoff) → now kept
    expect(isAfterAllowedEndTime({ ...base, recordedAt: "2026-07-20T15:35:00.000Z" })).toBe(false);
    // 2026-07-20T18:25:00Z = 23:55 IST (same day) → kept
    expect(isAfterAllowedEndTime({ ...base, recordedAt: "2026-07-20T18:25:00.000Z" })).toBe(false);
  });

  test("SE drops points that spill into the NEXT IST day", () => {
    const base = { sessionDate: "2026-07-20", timezone: "Asia/Kolkata", cutoffHour: 24 };
    // 2026-07-20T18:35:00Z = 00:05 IST on 2026-07-21 → dropped
    expect(isAfterAllowedEndTime({ ...base, recordedAt: "2026-07-20T18:35:00.000Z" })).toBe(true);
    // 2026-07-21T05:00:00Z = 10:30 IST next day → dropped
    expect(isAfterAllowedEndTime({ ...base, recordedAt: "2026-07-21T05:00:00.000Z" })).toBe(true);
  });

  test("Logistics (no cutoff) keeps points on any day, including after midnight", () => {
    const base = { sessionDate: "2026-07-20", timezone: "Asia/Kolkata", cutoffHour: null };
    expect(isAfterAllowedEndTime({ ...base, recordedAt: "2026-07-20T15:35:00.000Z" })).toBe(false);
    expect(isAfterAllowedEndTime({ ...base, recordedAt: "2026-07-21T05:00:00.000Z" })).toBe(false);
  });
});
