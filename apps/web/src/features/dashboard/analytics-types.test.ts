import { describe, expect, it } from "vitest";
import { dateLabel, packLabel } from "./analytics-types";

describe("packLabel", () => {
  it("renders sub-litre packs in millilitres", () => {
    expect(packLabel(0.5)).toBe("500 mL");
  });
  it("renders whole litres", () => {
    expect(packLabel(5)).toBe("5 L");
  });
  it("renders fractional litres", () => {
    expect(packLabel(2.5)).toBe("2.5 L");
  });
});

describe("dateLabel", () => {
  it("returns 'never' when there is no date", () => {
    expect(dateLabel(null)).toBe("never");
  });
  it("formats an ISO date as day + short month", () => {
    // ICU renders the short month as "Sep" or "Sept" depending on version.
    expect(dateLabel("2026-09-15")).toMatch(/^15 Sept?$/);
  });
});
