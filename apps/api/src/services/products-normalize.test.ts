import { describe, expect, it } from "vitest";
import { normalizeProductName } from "./products";

describe("normalizeProductName", () => {
  it("replaces non-breaking spaces with a regular space", () => {
    expect(normalizeProductName("TITAN SUPERGEAR 85W-140")).toBe("TITAN SUPERGEAR 85W-140");
    expect(normalizeProductName("SILKOLENE RSF 7.5 PLA")).toBe("SILKOLENE RSF 7.5 PLA");
  });

  it("collapses runs of whitespace and trims", () => {
    expect(normalizeProductName("TITAN  SYN SAE 5W-40")).toBe("TITAN SYN SAE 5W-40");
    expect(normalizeProductName("  TITAN FFL-3   N PLA  ")).toBe("TITAN FFL-3 N PLA");
    expect(normalizeProductName("A\t\nB")).toBe("A B");
  });

  it("leaves already-clean names unchanged", () => {
    expect(normalizeProductName("TITAN FORMULA SN SAE 5W-30")).toBe("TITAN FORMULA SN SAE 5W-30");
  });
});
