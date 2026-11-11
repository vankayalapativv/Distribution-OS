import { describe, expect, it } from "vitest";
import { distanceLabel, isActiveRun, runDuration } from "./logistics-run-format";

describe("runDuration", () => {
  it("formats hours and minutes between start and end", () => {
    expect(runDuration("2026-09-14T02:42:00Z", "2026-09-14T10:17:00Z")).toBe("7h 35m");
  });

  it("shows only minutes when under an hour", () => {
    expect(runDuration("2026-09-14T02:00:00Z", "2026-09-14T02:45:00Z")).toBe("45m");
  });

  it("measures elapsed to now when the run is still active (no end)", () => {
    const start = "2026-09-14T02:00:00Z";
    const now = Date.parse("2026-09-14T05:30:00Z");
    expect(runDuration(start, null, now)).toBe("3h 30m");
  });

  it("returns null for an unparseable start, bad end, or end before start", () => {
    expect(runDuration("nope", "2026-09-14T10:00:00Z")).toBeNull();
    expect(runDuration("2026-09-14T02:00:00Z", "nope")).toBeNull();
    expect(runDuration("2026-09-14T10:00:00Z", "2026-09-14T09:00:00Z")).toBeNull();
  });
});

describe("isActiveRun", () => {
  it("is active when status says so or there is no end time", () => {
    expect(isActiveRun("active", null)).toBe(true);
    expect(isActiveRun("ended", null)).toBe(true);
    expect(isActiveRun("active", "2026-09-14T10:00:00Z")).toBe(true);
  });

  it("is not active once ended with an end time", () => {
    expect(isActiveRun("ended", "2026-09-14T10:00:00Z")).toBe(false);
  });
});

describe("distanceLabel", () => {
  it("appends km, or an em-dash when unknown", () => {
    expect(distanceLabel(142)).toBe("142 km");
    expect(distanceLabel(null)).toBe("—");
  });
});
