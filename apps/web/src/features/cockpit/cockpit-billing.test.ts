import { describe, expect, it } from "vitest";
import { basePaisaFromInclusive, freeModeFromConfig, freePayload, gstBreakdown, inclusivePaisa } from "./cockpit-billing";

describe("cockpit-billing GST math", () => {
  it("adds 18% to a base (₹999 → ₹1,178.82)", () => {
    expect(inclusivePaisa(99900)).toBe(117882);
  });
  it("round-trips base ↔ inclusive", () => {
    expect(basePaisaFromInclusive(117882)).toBe(99900);
    expect(basePaisaFromInclusive(null)).toBe(0);
    expect(basePaisaFromInclusive(0)).toBe(0);
  });
  it("breaks down a base price for display", () => {
    const b = gstBreakdown(999);
    expect(b.base).toBe("₹999");
    expect(b.gst).toBe("₹179.82");
    expect(b.total).toBe("₹1,178.82");
  });
});

describe("cockpit-billing free modes", () => {
  it("maps each mode to its payload", () => {
    expect(freePayload("immediate")).toEqual({ freeMonths: 0, freeForever: false });
    expect(freePayload("this_month")).toEqual({ freeMonths: 1, freeForever: false });
    expect(freePayload("n_months", 3)).toEqual({ freeMonths: 3, freeForever: false });
    expect(freePayload("forever")).toEqual({ freeForever: true });
  });
  it("clamps an invalid n_months to 1", () => {
    expect(freePayload("n_months", 0)).toEqual({ freeMonths: 1, freeForever: false });
    expect(freePayload("n_months", NaN)).toEqual({ freeMonths: 1, freeForever: false });
  });
  it("reads a FreeMode back from a config", () => {
    expect(freeModeFromConfig({ freeForever: true })).toBe("forever");
    expect(freeModeFromConfig({ freeUntil: "2026-12-01T00:00:00Z" })).toBe("n_months");
    expect(freeModeFromConfig({})).toBe("immediate");
    expect(freeModeFromConfig(null)).toBe("immediate");
  });
});
