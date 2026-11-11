import { describe, expect, it } from "vitest";
import { activityChip } from "./activity-chip";

// Fixed "now": Tue 29 Sep 2026.
const now = new Date(2026, 8, 29, 11, 0, 0);
const green = "bg-emerald-100";
const orange = "bg-orange-100";
const red = "bg-red-100";

describe("activityChip — order", () => {
  it("labels with full words + day count", () => {
    expect(activityChip("order", "2026-09-29", now).text).toBe("Last order today");
    expect(activityChip("order", "2026-07-27", now).text).toBe("Last order 64 days ago");
  });

  it("grades green 0–21, orange 22–30, red 31+", () => {
    expect(activityChip("order", "2026-09-29", now).bgClass).toBe(green); // 0d
    expect(activityChip("order", "2026-09-08", now).bgClass).toBe(green); // 21d (edge → green)
    expect(activityChip("order", "2026-09-07", now).bgClass).toBe(orange); // 22d
    expect(activityChip("order", "2026-08-30", now).bgClass).toBe(orange); // 30d (edge → orange)
    expect(activityChip("order", "2026-08-29", now).bgClass).toBe(red); // 31d
  });

  it("shows a red 'No orders yet' when never ordered", () => {
    const c = activityChip("order", null, now);
    expect(c.text).toBe("No orders yet");
    expect(c.bgClass).toBe(red);
  });
});

describe("activityChip — collection", () => {
  it("grades green 0–7, orange 8–14, red 15+", () => {
    expect(activityChip("collection", "2026-09-22", now).bgClass).toBe(green); // 7d (edge → green)
    expect(activityChip("collection", "2026-09-21", now).bgClass).toBe(orange); // 8d
    expect(activityChip("collection", "2026-09-15", now).bgClass).toBe(orange); // 14d (edge → orange)
    expect(activityChip("collection", "2026-09-14", now).bgClass).toBe(red); // 15d
  });

  it("shows a red 'No collections yet' when never collected", () => {
    const c = activityChip("collection", null, now);
    expect(c.text).toBe("No collections yet");
    expect(c.bgClass).toBe(red);
  });
});
