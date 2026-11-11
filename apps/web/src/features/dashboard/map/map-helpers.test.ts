import { describe, expect, it } from "vitest";
import { BAND_RAMP, CLEAR_COLOR, bandMeta, bucketColor, rupees } from "./map-helpers";

describe("bucketColor", () => {
  it("maps a band ordinal key to its ramp colour (clamped past the last band)", () => {
    expect(bucketColor("0")).toBe(BAND_RAMP[0]);
    expect(bucketColor("3")).toBe(BAND_RAMP[3]);
    expect(bucketColor("9")).toBe(BAND_RAMP[BAND_RAMP.length - 1]); // clamp
  });
  it("falls back to the neutral colour for a null/invalid bucket", () => {
    expect(bucketColor(null)).toBe(CLEAR_COLOR);
    expect(bucketColor("x")).toBe(CLEAR_COLOR);
  });
});

describe("bandMeta", () => {
  it("resolves per-enterprise labels + ordinal colours, 'No dues' for null", () => {
    const meta = bandMeta([
      { key: "0", ordinal: 0, fromDays: 0, toDays: 15, label: "Current" },
      { key: "1", ordinal: 1, fromDays: 16, toDays: 40, label: "Watch" },
      { key: "2", ordinal: 2, fromDays: 41, toDays: 60, label: "Due" },
      { key: "3", ordinal: 3, fromDays: 61, toDays: null, label: "Overdue" },
    ]);
    expect(meta.order).toEqual(["0", "1", "2", "3"]);
    expect(meta.label("1")).toBe("Watch");
    expect(meta.label(null)).toBe("No dues");
    expect(meta.color("3")).toBe(BAND_RAMP[3]);
  });
  it("falls back to the default bands when none are supplied", () => {
    const meta = bandMeta(undefined);
    expect(meta.order).toEqual(["0", "1", "2", "3"]);
    expect(meta.label("0")).toBe("0–30 days");
  });
});

describe("rupees", () => {
  it("formats with Indian grouping and no paise", () => {
    expect(rupees(1234567)).toBe("₹12,34,567");
    expect(rupees(999.7)).toBe("₹1,000");
  });
});
