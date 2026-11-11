import { describe, expect, it } from "vitest";
import { barColor, pctTextColor } from "./target-bar-colors";

describe("barColor / pctTextColor tiers", () => {
  it("map each completion tier to its colour", () => {
    expect(barColor(100)).toBe("bg-green-600");
    expect(barColor(60)).toBe("bg-blue-500");
    expect(barColor(30)).toBe("bg-amber-500");
    expect(barColor(0)).toBe("bg-red-500");
    expect(pctTextColor(120)).toBe("text-green-600");
    expect(pctTextColor(75)).toBe("text-blue-600");
    expect(pctTextColor(45)).toBe("text-amber-600");
    expect(pctTextColor(10)).toBe("text-red-600");
  });
});
