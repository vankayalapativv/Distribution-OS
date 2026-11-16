import { describe, expect, test } from "vitest";
import { trackingCutoffHour, isAfterAllowedEndTime } from "./tracking-sessions";

describe("tracking cutoff (SE configurable auto-stop hour; Logistics none)", () => {
  test("SE cutoff is the configured stop hour; Logistics has none", () => {
    expect(trackingCutoffHour("SALES_EXECUTIVE", 19)).toBe(19);
    expect(trackingCutoffHour("SALES_EXECUTIVE", 21)).toBe(21);
    expect(trackingCutoffHour("LOGISTICS", 19)).toBeNull();
    // Unknown / other roles are treated like Logistics (no cutoff).
    expect(trackingCutoffHour(null, 19)).toBeNull();
    expect(trackingCutoffHour(undefined, 19)).toBeNull();
  });

  test("SE keeps points before the stop hour, drops points at/after it (7 PM)", () => {
    const base = { sessionDate: "2026-07-20", timezone: "Asia/Kolkata", cutoffHour: 19 };
    // 2026-07-20T10:00:00Z = 15:30 IST (before 19:00) → kept
    expect(isAfterAllowedEndTime({ ...base, recordedAt: "2026-07-20T10:00:00.000Z" })).toBe(false);
    // 2026-07-20T13:29:00Z = 18:59 IST (before 19:00) → kept
    expect(isAfterAllowedEndTime({ ...base, recordedAt: "2026-07-20T13:29:00.000Z" })).toBe(false);
    // 2026-07-20T13:30:00Z = 19:00 IST (at the stop hour) → dropped
    expect(isAfterAllowedEndTime({ ...base, recordedAt: "2026-07-20T13:30:00.000Z" })).toBe(true);
    // 2026-07-20T15:35:00Z = 21:05 IST (past the stop hour) → dropped
    expect(isAfterAllowedEndTime({ ...base, recordedAt: "2026-07-20T15:35:00.000Z" })).toBe(true);
  });

  test("SE drops points that spill into the NEXT IST day", () => {
    const base = { sessionDate: "2026-07-20", timezone: "Asia/Kolkata", cutoffHour: 19 };
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
