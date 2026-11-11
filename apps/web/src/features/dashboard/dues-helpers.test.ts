import { describe, expect, it } from "vitest";
import { accentForIndex } from "./dues-helpers";

describe("accentForIndex", () => {
  it("grades the accent by band position — newest cool, oldest hot", () => {
    // 3 bands: first is coolest, last is hottest.
    expect(accentForIndex(0, 3)).toBe("border-l-emerald-300");
    expect(accentForIndex(2, 3)).toBe("border-l-rose-300");
    // A middle band lands on a warmer-than-first, cooler-than-last stop.
    expect(accentForIndex(1, 3)).not.toBe("border-l-emerald-300");
    expect(accentForIndex(1, 3)).not.toBe("border-l-rose-300");
  });

  it("handles a single band and clamps safely", () => {
    expect(accentForIndex(0, 1)).toBe("border-l-emerald-300");
    expect(accentForIndex(0, 0)).toBe("border-l-emerald-300");
  });
});
