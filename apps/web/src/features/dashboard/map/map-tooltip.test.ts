import { describe, expect, it } from "vitest";
import { districtHoverTooltip, ensureTooltipStyles, escapeHtml } from "./map-tooltip";
import { bandMeta, type MapCustomer } from "./map-helpers";

const META = bandMeta(undefined); // default 4 bands, keys "0".."3"

const cust = (over: Partial<MapCustomer>): MapCustomer => ({
  id: "c", name: "Shop", code: "C", city: "Guntur", lat: 17, lng: 78,
  executiveId: "e", executiveName: "Ravi", outstanding: 0, ageDays: null, bucket: null,
  lastOrderDays: null, lastCollectionDays: null, active: true,
  ...over,
});

describe("escapeHtml", () => {
  it("escapes every HTML-significant character", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});

describe("ensureTooltipStyles", () => {
  it("injects the style tag once (idempotent)", () => {
    document.getElementById("district-tip-styles")?.remove();
    ensureTooltipStyles();
    ensureTooltipStyles();
    expect(document.querySelectorAll("#district-tip-styles").length).toBe(1);
  });
});

describe("districtHoverTooltip", () => {
  it("renders header, total dues, the ageing table and top execs", () => {
    const html = districtHoverTooltip("Hyderabad", [
      cust({ outstanding: 5000, bucket: "0", executiveName: "Ravi" }),
      cust({ outstanding: 1000, bucket: "0", executiveName: "Ravi" }), // same bucket → tally else-branch
      cust({ outstanding: 2000, bucket: "3", executiveName: "Sita" }),
      cust({ outstanding: 0, bucket: "2", executiveName: "Sita" }), // bucketed, zero owed → `outstanding || 0` false
      cust({ outstanding: 0, bucket: null, executiveName: null }),
    ], META);
    expect(html).toContain("Hyderabad");
    expect(html).toContain("5 customers");
    expect(html).toContain("Total dues");
    expect(html).toContain("Ageing");
    expect(html).toContain("Top execs"); // plural (>1 exec)
  });

  it("uses singular nouns for a single customer + exec", () => {
    const html = districtHoverTooltip("Solo", [cust({ outstanding: 100, bucket: "0" })], META);
    expect(html).toContain("1 customer<");
    expect(html).toContain("Top exec:");
  });
});
