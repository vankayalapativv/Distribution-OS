import { describe, expect, it } from "vitest";
import { bucketFromAge } from "./dues";

describe("bucketFromAge", () => {
  it("returns null when there is nothing outstanding", () => {
    expect(bucketFromAge(null)).toBeNull();
  });

  it("puts a fresh invoice (0 days) in 0_30", () => {
    expect(bucketFromAge(0)).toBe("0_30");
  });

  it("uses inclusive upper bounds at 30 / 45 / 60", () => {
    expect(bucketFromAge(30)).toBe("0_30");
    expect(bucketFromAge(31)).toBe("30_45");
    expect(bucketFromAge(45)).toBe("30_45");
    expect(bucketFromAge(46)).toBe("45_60");
    expect(bucketFromAge(60)).toBe("45_60");
    expect(bucketFromAge(61)).toBe("60_plus");
  });

  it("treats a negative/invalid age as no bucket", () => {
    expect(bucketFromAge(-5)).toBeNull();
  });
});
