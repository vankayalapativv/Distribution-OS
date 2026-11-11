import { describe, expect, it, afterEach, vi } from "vitest";
import { PRESETS, fyStart, presetRange, triggerLabel } from "./customer-ledger-range-data";

afterEach(() => vi.useRealTimers());

const freeze = (iso: string) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
};

describe("PRESETS", () => {
  it("lists the five non-custom presets", () => {
    expect(PRESETS.map((p) => p.key)).toEqual(["this-month", "last-month", "last-3-months", "this-fy", "all"]);
  });
});

const local = (d: Date) => [d.getFullYear(), d.getMonth(), d.getDate()];

describe("fyStart", () => {
  it("uses the current year from April onward", () => {
    expect(local(fyStart(new Date(2026, 5, 10)))).toEqual([2026, 3, 1]);
  });
  it("uses the previous year before April", () => {
    expect(local(fyStart(new Date(2026, 1, 10)))).toEqual([2025, 3, 1]);
  });
});

describe("presetRange", () => {
  it("computes each preset relative to today", () => {
    freeze("2026-06-15T09:00:00");
    expect(presetRange("this-month")).toEqual({ from: "2026-06-01", to: "2026-06-15" });
    expect(presetRange("last-month")).toEqual({ from: "2026-05-01", to: "2026-05-31" });
    expect(presetRange("last-3-months")).toEqual({ from: "2026-04-01", to: "2026-06-15" });
    expect(presetRange("this-fy")).toEqual({ from: "2026-04-01", to: "2026-06-15" });
    expect(presetRange("all")).toEqual({ from: "2015-01-01", to: "2026-06-15" });
  });
});

describe("triggerLabel", () => {
  it("labels the all-time preset, blank ranges, and a real range", () => {
    expect(triggerLabel("", "", "all")).toBe("All time");
    expect(triggerLabel("", "", "custom")).toBe("Pick a range");
    expect(triggerLabel("2026-06-01", "2026-06-15", "custom")).toBe("01 Jun 2026 – 15 Jun 2026");
  });
});
