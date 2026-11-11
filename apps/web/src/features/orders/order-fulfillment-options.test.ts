import { describe, expect, it } from "vitest";
import { FULFILLMENT_ROW_BG, FULFILLMENT_FILTER_OPTIONS } from "./order-fulfillment-options";

describe("FULFILLMENT_ROW_BG", () => {
  it("has a wash for every ladder stage incl. cancelled", () => {
    expect(Object.keys(FULFILLMENT_ROW_BG).sort()).toEqual(
      [
        "cancelled",
        "delivered",
        "invoiced",
        "ordered",
        "partially_delivered",
        "partially_invoiced",
        "partially_returned",
        "returned",
      ].sort(),
    );
    for (const cls of Object.values(FULFILLMENT_ROW_BG)) expect(cls).toMatch(/^bg-/);
  });
});

describe("FULFILLMENT_FILTER_OPTIONS", () => {
  it("leads with All (empty value) and includes Cancelled", () => {
    expect(FULFILLMENT_FILTER_OPTIONS[0]).toEqual({ value: "", label: "All" });
    expect(FULFILLMENT_FILTER_OPTIONS.map((o) => o.value)).toContain("cancelled");
  });

  it("offers all eight ladder stages plus All (9 rows)", () => {
    expect(FULFILLMENT_FILTER_OPTIONS).toHaveLength(9);
  });
});
