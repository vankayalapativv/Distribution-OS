import { describe, expect, it } from "vitest";
import { dateLabel, FULFILLMENT_LABEL, packLabel, STATUS_CHIP } from "./order-detail-sheet-utils";

describe("order-detail-sheet-utils", () => {
  it("maps every fulfillment status to a chip + label", () => {
    expect(Object.keys(STATUS_CHIP)).toEqual(Object.keys(FULFILLMENT_LABEL));
    expect(FULFILLMENT_LABEL.delivered).toBe("Delivered");
    expect(STATUS_CHIP.cancelled).toMatch(/red/);
  });

  it("packLabel renders mL under a litre, L otherwise", () => {
    expect(packLabel(0.5)).toBe("500 mL");
    expect(packLabel(5)).toBe("5 L");
    expect(packLabel(0)).toBe("0 L");
  });

  it("dateLabel formats an ISO date, empty for null", () => {
    expect(dateLabel(null)).toBe("");
    expect(dateLabel("2026-11-27")).toMatch(/27 Nov 2026/);
  });
});
