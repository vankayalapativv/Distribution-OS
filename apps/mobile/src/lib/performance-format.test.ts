import { describe, expect, it } from "vitest";
import { collectionsForTab } from "./performance-format";
import type { MyPerformance } from "./performance";

function perf(over: Partial<MyPerformance> = {}): MyPerformance {
  return {
    today: { date: "2026-08-05", oilActual: [], collections: { total: 100, verified: 60 } },
    week: {
      periodStart: "2026-08-03",
      oilActual: [],
      oilTarget: null,
      collections: { total: 700, verified: 400 },
    },
    month: {
      periodStart: "2026-08-01",
      oilActual: [],
      oilTarget: null,
      collections: { total: 3000, verified: 1800 },
    },
    ...over,
  };
}

describe("collectionsForTab", () => {
  it("returns the collections for each tab", () => {
    const p = perf();
    expect(collectionsForTab(p, "today")).toEqual({ total: 100, verified: 60 });
    expect(collectionsForTab(p, "week")).toEqual({ total: 700, verified: 400 });
    expect(collectionsForTab(p, "month")).toEqual({ total: 3000, verified: 1800 });
  });

  it("falls back to zeros for an older cached payload missing the field", () => {
    const stale = { today: { date: "x", oilActual: [] } } as unknown as MyPerformance;
    expect(collectionsForTab(stale, "today")).toEqual({ total: 0, verified: 0 });
  });

  it("falls back to zeros when the period itself is absent", () => {
    const stale = {} as unknown as MyPerformance;
    expect(collectionsForTab(stale, "week")).toEqual({ total: 0, verified: 0 });
  });
});
