import { describe, expect, it, vi } from "vitest";
import { buildTiles, productivityPct, tileRows } from "./admin-kpi-grid-tiles";
import type { DashboardMetrics } from "../../lib/admin-dashboard";

const metrics: DashboardMetrics = {
  range: { from: "2026-11-01", to: "2026-11-27" },
  activeExecutives: { live: 3, total: 5 },
  visits: 10,
  productiveVisits: 7,
  sales: { litres: 257.7, orders: 12 },
  orderedOils: { litres: 300, orders: 15 },
  oilsByBrand: [
    { brand: "Shell", litres: 120, orders: 6 },
    { brand: "Castrol", litres: 80.5, orders: 4 },
  ],
  collections: { total: 45000.4, verified: 40000, pendingCount: 1, count: 8 },
} as DashboardMetrics;

const openAll = () => () => {};

describe("productivityPct", () => {
  it("is 0 without metrics or visits, else the rounded ratio", () => {
    expect(productivityPct(null)).toBe(0);
    expect(productivityPct({ ...metrics, visits: 0 })).toBe(0);
    expect(productivityPct(metrics)).toBe(70);
  });
});

describe("buildTiles", () => {
  it("shimmers (undefined values, no onPress) while metrics load", () => {
    const tiles = buildTiles(null, () => undefined);
    expect(tiles).toHaveLength(5); // only the fixed cards, no brand tiles
    expect(tiles.every((t) => t.value === undefined)).toBe(true);
    expect(tiles.every((t) => t.onPress === undefined)).toBe(true);
  });

  it("formats the fixed cards and appends a tile per brand", () => {
    const tiles = buildTiles(metrics, openAll);
    const byKey = Object.fromEntries(tiles.map((t) => [t.key, t]));
    expect(byKey.executives.value).toBe("3/5");
    expect(byKey.productivity.value).toBe("70%");
    expect(byKey.ordered.value).toBe("300 L"); // integer litres
    expect(byKey.litres.value).toBe("257.7 L"); // one decimal
    expect(byKey.collections.value).toBe("₹45,000"); // rounded inr
    expect(byKey.collections.sub).toBe("8 entries");
    expect(typeof byKey.executives.onPress).toBe("function");
    // Brand tiles (display-only, no onPress).
    expect(byKey["brand:Shell"].value).toBe("120 L");
    expect(byKey["brand:Castrol"].value).toBe("80.5 L");
    expect(byKey["brand:Shell"].onPress).toBeUndefined();
    expect(tiles).toHaveLength(7);
  });
});

describe("tileRows", () => {
  it("chunks tiles into rows of two (odd trailing row of one)", () => {
    const open = vi.fn(() => undefined);
    const rows = tileRows(buildTiles(metrics, open));
    expect(rows).toHaveLength(4); // 7 tiles → 3 full rows + 1
    expect(rows[3]).toHaveLength(1);
  });
});
