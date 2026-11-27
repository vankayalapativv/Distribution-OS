import { describe, expect, it } from "vitest";
import { barColor, litresLabel, pctOf, rupeesLabel } from "./performance-card-format";

describe("performance-card-format", () => {
  it("litresLabel groups with the Indian locale and a L suffix", () => {
    expect(litresLabel(1234)).toBe("1,234 L");
  });

  it("rupeesLabel rounds and prefixes ₹", () => {
    expect(rupeesLabel(162158.6)).toBe("₹1,62,159");
  });

  it("barColor steps through the four thresholds", () => {
    expect(barColor(100)).toBe("bg-green-600");
    expect(barColor(60)).toBe("bg-blue-500");
    expect(barColor(30)).toBe("bg-amber-500");
    expect(barColor(0)).toBe("bg-red-500");
  });

  it("pctOf returns null without a positive target and clamps at 100", () => {
    expect(pctOf(5, null)).toBeNull();
    expect(pctOf(5, 0)).toBeNull();
    expect(pctOf(50, 100)).toBe(50);
    expect(pctOf(200, 100)).toBe(100);
  });
});
