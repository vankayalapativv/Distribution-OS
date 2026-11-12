import { describe, expect, test } from "vitest";
import { bucketColor, bucketLabel, BAND_RAMP, CLEAR_COLOR } from "./tracking-overlays";
import type { DuesBand } from "./admin-tracking";

/**
 * The /dashboard/map server sends a customer's bucket as the enterprise band's
 * ORDINAL ("0".."N"), not the old fixed keys ("0_30"…). These guard that
 * bucketColor is ordinal-based (and never throws on an unexpected key) and that
 * bucketLabel reads the enterprise's own band labels. Regression for the
 * "Cannot read property 'color' of undefined" render crash.
 */
const BANDS: DuesBand[] = [
  { key: "0", ordinal: 0, fromDays: 0, toDays: 30, label: "0–30 days" },
  { key: "1", ordinal: 1, fromDays: 31, toDays: 45, label: "31–45 days" },
  { key: "2", ordinal: 2, fromDays: 46, toDays: 60, label: "46–60 days" },
  { key: "3", ordinal: 3, fromDays: 61, toDays: null, label: "61+ days" },
];

describe("bucketColor (ordinal ramp)", () => {
  test("maps each ordinal to its ramp colour", () => {
    expect(bucketColor("0")).toBe(BAND_RAMP[0]);
    expect(bucketColor("1")).toBe(BAND_RAMP[1]);
    expect(bucketColor("2")).toBe(BAND_RAMP[2]);
    expect(bucketColor("3")).toBe(BAND_RAMP[3]);
  });
  test("clamps bands beyond the ramp to the most-overdue colour", () => {
    expect(bucketColor("7")).toBe(BAND_RAMP[BAND_RAMP.length - 1]);
  });
  test("null (no dues) and unrecognised keys are the clear colour — never throws", () => {
    expect(bucketColor(null)).toBe(CLEAR_COLOR);
    expect(bucketColor("0_30")).toBe(CLEAR_COLOR); // the old key must not crash
    expect(bucketColor("-1")).toBe(CLEAR_COLOR);
  });
});

describe("bucketLabel (enterprise bands)", () => {
  test("resolves the enterprise's own band label", () => {
    expect(bucketLabel("0", BANDS)).toBe("0–30 days");
    expect(bucketLabel("3", BANDS)).toBe("61+ days");
  });
  test("null is 'No dues'", () => {
    expect(bucketLabel(null, BANDS)).toBe("No dues");
  });
  test("falls back to the key when bands are missing or don't include it", () => {
    expect(bucketLabel("2")).toBe("2");
    expect(bucketLabel("9", BANDS)).toBe("9");
  });
});
