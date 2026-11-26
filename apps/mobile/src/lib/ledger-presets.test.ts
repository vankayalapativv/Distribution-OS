import { afterEach, describe, expect, it, vi } from "vitest";
import { PRESETS, presetRange, ymd, type PresetKey } from "./ledger-presets";

afterEach(() => vi.useRealTimers());

function at(iso: string): void {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
}

describe("ymd", () => {
  it("formats a Date as zero-padded yyyy-mm-dd (local parts)", () => {
    expect(ymd(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(ymd(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("PRESETS", () => {
  it("lists the five ranges in order", () => {
    expect(PRESETS.map((p) => p.key)).toEqual([
      "this-month",
      "last-month",
      "last-3-months",
      "this-fy",
      "all",
    ]);
  });
});

describe("presetRange (mid-year: 15 Jul 2026)", () => {
  it("this-month starts on the 1st, ends today", () => {
    at("2026-07-15T10:00:00");
    expect(presetRange("this-month")).toEqual({ from: "2026-07-01", to: "2026-07-15" });
  });
  it("last-month spans the whole previous month", () => {
    at("2026-07-15T10:00:00");
    expect(presetRange("last-month")).toEqual({ from: "2026-06-01", to: "2026-06-30" });
  });
  it("last-3-months starts two months back on the 1st", () => {
    at("2026-07-15T10:00:00");
    expect(presetRange("last-3-months")).toEqual({ from: "2026-05-01", to: "2026-07-15" });
  });
  it("this-fy starts 1 April of the current FY", () => {
    at("2026-07-15T10:00:00");
    expect(presetRange("this-fy")).toEqual({ from: "2026-04-01", to: "2026-07-15" });
  });
  it("all starts at the epoch floor", () => {
    at("2026-07-15T10:00:00");
    expect(presetRange("all")).toEqual({ from: "2000-01-01", to: "2026-07-15" });
  });
});

describe("presetRange (before April: 15 Feb 2026 → FY started 2025)", () => {
  it("this-fy rolls back to the prior calendar year's April", () => {
    at("2026-02-15T10:00:00");
    expect(presetRange("this-fy")).toEqual({ from: "2025-04-01", to: "2026-02-15" });
  });
});

describe("presetRange (January 2026 → last-month crosses the year)", () => {
  it("last-month is the previous December", () => {
    at("2026-01-15T10:00:00");
    expect(presetRange("last-month")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
  });
});

describe("presetRange exhaustiveness", () => {
  it("returns a range for every preset key", () => {
    at("2026-07-15T10:00:00");
    const keys: PresetKey[] = ["this-month", "last-month", "last-3-months", "this-fy", "all"];
    for (const k of keys) {
      const r = presetRange(k);
      expect(r.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
