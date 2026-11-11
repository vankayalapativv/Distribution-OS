import { describe, expect, it } from "vitest";
import { hasTarget, segLitres, sumLitres } from "./targets-api";
import type { PeriodProgress } from "./targets-api";

const progress = (over: Partial<PeriodProgress> = {}): PeriodProgress => ({
  periodStart: "2026-07-01", oilActual: [], oilTarget: null, ...over,
});

describe("sumLitres", () => {
  it("adds up litres across segments", () => {
    expect(sumLitres([{ segment: "Car", litres: 10 }, { segment: "2W", litres: 5 }])).toBe(15);
    expect(sumLitres([])).toBe(0);
  });
});

describe("segLitres", () => {
  const segs = [{ segment: "Car", litres: 12 }];
  it("finds a segment's litres, else 0", () => {
    expect(segLitres(segs, "Car")).toBe(12);
    expect(segLitres(segs, "2W")).toBe(0);
    expect(segLitres(null, "Car")).toBe(0);
  });
});

describe("hasTarget", () => {
  it("is true only when an oil target is set", () => {
    expect(hasTarget(progress())).toBe(false);
    expect(hasTarget(progress({ oilTarget: [] }))).toBe(true);
  });
});
