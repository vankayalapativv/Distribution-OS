import { describe, expect, it } from "vitest";
import {
  BAND_RAMP, CLEAR_COLOR, bucketColor, bucketLabel, checkinTime, collectionChip, orderChip, rupees,
} from "./tracking-overlays";

describe("bucketColor", () => {
  it("is the clear colour for null / invalid / negative keys", () => {
    expect(bucketColor(null)).toBe(CLEAR_COLOR);
    expect(bucketColor("x")).toBe(CLEAR_COLOR);
    expect(bucketColor("-1")).toBe(CLEAR_COLOR);
  });
  it("maps ordinals onto the ramp, clamping past the last band", () => {
    expect(bucketColor("0")).toBe(BAND_RAMP[0]);
    expect(bucketColor("3")).toBe(BAND_RAMP[3]);
    expect(bucketColor("9")).toBe(BAND_RAMP[3]); // clamp
  });
});

describe("bucketLabel", () => {
  it("is 'No dues' when clear", () => { expect(bucketLabel(null)).toBe("No dues"); });
  it("uses the enterprise band label when found", () => {
    expect(bucketLabel("1", [{ key: "1", ordinal: 1, fromDays: 0, toDays: 30, label: "0–30d" }])).toBe("0–30d");
  });
  it("falls back to the key when the band list lacks it or is omitted", () => {
    expect(bucketLabel("2", [])).toBe("2");
    expect(bucketLabel("2")).toBe("2"); // no bands arg → ?? [] default
  });
});

describe("rupees", () => {
  it("formats with Indian grouping and no paise", () => {
    expect(rupees(1234567.8)).toBe("₹12,34,568");
  });
});

describe("orderChip / collectionChip", () => {
  it("orderChip tones by recency (green/orange/red + never)", () => {
    expect(orderChip(null).label).toBe("No orders yet");
    expect(orderChip(0).label).toBe("Last order today");
    expect(orderChip(1).label).toBe("Last order 1 day ago");
    expect(orderChip(10).fg).toBe(orderChip(21).fg); // both green
    expect(orderChip(25).label).toMatch(/25 days ago/); // orange band
    expect(orderChip(40).fg).not.toBe(orderChip(10).fg); // red vs green
  });
  it("collectionChip tones by recency", () => {
    expect(collectionChip(null).label).toBe("No collections yet");
    expect(collectionChip(5).fg).toBe(collectionChip(7).fg); // green
    expect(collectionChip(12).label).toMatch(/12 days ago/); // orange
    expect(collectionChip(20).fg).not.toBe(collectionChip(5).fg); // red
  });
});

describe("checkinTime", () => {
  it("is empty without a timestamp", () => { expect(checkinTime(null)).toBe(""); });
  it("formats an IST time", () => {
    expect(checkinTime("2026-11-27T09:36:00.000Z")).toMatch(/\d{1,2}:\d{2}\s?(am|pm)/i); // 3:06 pm IST
  });
});
