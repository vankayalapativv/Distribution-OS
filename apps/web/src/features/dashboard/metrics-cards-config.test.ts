import { describe, expect, it } from "vitest";
import { fmtL, needsAttention, productivityPct } from "./metrics-cards-config";
import type { DashboardMetrics } from "./metrics-helpers";

function metrics(over: Partial<DashboardMetrics> = {}): DashboardMetrics {
  return {
    range: { from: "2026-09-15", to: "2026-09-15" },
    activeExecutives: { live: 2, total: 6 },
    visits: 10,
    productiveVisits: 5,
    sales: { litres: 100, orders: 3 },
    orderedOils: { litres: 120, orders: 4 },
    oilsByBrand: [],
    collections: { total: 5000, verified: 2000, pendingCount: 0, count: 4 },
    ...over,
  };
}

describe("fmtL", () => {
  it("drops the decimal for whole litres and keeps one otherwise", () => {
    expect(fmtL(257)).toBe("257");
    expect(fmtL(257.7)).toBe("257.7");
  });
});

describe("needsAttention", () => {
  it("flags collections with any pending verification", () => {
    expect(needsAttention("collections", metrics({ collections: { total: 0, verified: 0, pendingCount: 3, count: 1 } }))).toBe(true);
    expect(needsAttention("collections", metrics())).toBe(false);
  });
  it("flags executives when the team exists but nobody is live", () => {
    expect(needsAttention("executives", metrics({ activeExecutives: { live: 0, total: 6 } }))).toBe(true);
    expect(needsAttention("executives", metrics({ activeExecutives: { live: 2, total: 6 } }))).toBe(false);
    expect(needsAttention("executives", metrics({ activeExecutives: { live: 0, total: 0 } }))).toBe(false);
  });
  it("never flags other metrics", () => {
    expect(needsAttention("visits", metrics())).toBe(false);
  });
});

describe("productivityPct", () => {
  it("is productive ÷ visits as a percentage", () => {
    expect(productivityPct(metrics({ visits: 10, productiveVisits: 5 }))).toBe(50);
  });
  it("is 0 when there are no visits", () => {
    expect(productivityPct(metrics({ visits: 0, productiveVisits: 0 }))).toBe(0);
  });
});
