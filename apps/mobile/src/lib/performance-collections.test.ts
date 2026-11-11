import { describe, expect, it } from "vitest";
import { collectionsForTab } from "./performance-format";
import type { MyPerformance } from "./performance";

const base: MyPerformance = {
  today: { date: "2026-09-10", oilActual: [], collections: { total: 500, verified: 200 } },
  week: { periodStart: "2026-09-08", oilActual: [], oilTarget: null, collections: { total: 3000, verified: 1000 } },
  month: { periodStart: "2026-09-01", oilActual: [], oilTarget: null, collections: { total: 9000, verified: 4000 } },
};

describe("collectionsForTab", () => {
  it("returns the collections for the selected tab", () => {
    expect(collectionsForTab(base, "today")).toEqual({ total: 500, verified: 200 });
    expect(collectionsForTab(base, "week")).toEqual({ total: 3000, verified: 1000 });
    expect(collectionsForTab(base, "month")).toEqual({ total: 9000, verified: 4000 });
  });

  it("falls back to zero for an older cached payload missing collections", () => {
    const stale = { ...base, today: { date: "x", oilActual: [] } } as unknown as MyPerformance;
    expect(collectionsForTab(stale, "today")).toEqual({ total: 0, verified: 0 });
  });
});
