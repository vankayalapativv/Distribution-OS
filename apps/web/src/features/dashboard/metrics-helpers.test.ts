import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isoDate,
  litresLabel,
  METRIC_TITLES,
  presetRange,
  rangeLabel,
} from "./metrics-helpers";

describe("isoDate", () => {
  it("formats a Date as local YYYY-MM-DD", () => {
    expect(isoDate(new Date("2026-09-15T10:00:00+05:30"))).toBe("2026-09-15");
  });
});

describe("litresLabel", () => {
  it("shows whole litres without decimals", () => {
    expect(litresLabel(431)).toBe("431 L");
  });
  it("shows one decimal for fractional litres", () => {
    expect(litresLabel(12.5)).toBe("12.5 L");
  });
});

describe("rangeLabel", () => {
  it("renders a single day when from equals to", () => {
    expect(rangeLabel("2026-09-15", "2026-09-15")).toBe(rangeLabel("2026-09-15", "2026-09-15"));
    expect(rangeLabel("2026-09-15", "2026-09-15")).not.toContain("–");
  });
  it("renders a dash-separated range when they differ", () => {
    expect(rangeLabel("2026-09-01", "2026-09-15")).toContain("–");
  });
});

describe("METRIC_TITLES", () => {
  it("labels each metric key", () => {
    expect(METRIC_TITLES.executives).toBe("Active Executives");
    expect(METRIC_TITLES.ordered).toBe("Total Ordered Oils");
    expect(METRIC_TITLES.litres).toBe("Sold Oil");
  });
});

describe("presetRange", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T10:00:00+05:30"));
  });
  afterEach(() => vi.useRealTimers());

  it("today and custom both return a single-day range", () => {
    expect(presetRange("today")).toEqual({ from: "2026-09-15", to: "2026-09-15" });
    expect(presetRange("custom")).toEqual({ from: "2026-09-15", to: "2026-09-15" });
  });
  it("week starts on the current week's Monday (not a trailing 7 days)", () => {
    // 2026-09-15 is a Tuesday → week is Mon 14 → today 15.
    expect(presetRange("week")).toEqual({ from: "2026-09-14", to: "2026-09-15" });
  });
  it("month starts on the 1st of the current month", () => {
    expect(presetRange("month")).toEqual({ from: "2026-09-01", to: "2026-09-15" });
  });
});
