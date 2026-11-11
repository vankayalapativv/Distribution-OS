import { describe, expect, it } from "vitest";
import { buildMetricCards } from "./metrics-cards-data";
import type { DashboardMetrics } from "./metrics-helpers";
import type { MetricCard } from "./metrics-cards-config";

function metrics(over: Partial<DashboardMetrics> = {}): DashboardMetrics {
  return {
    range: { from: "2026-09-15", to: "2026-09-15" },
    activeExecutives: { live: 2, total: 6 },
    visits: 10,
    productiveVisits: 5,
    sales: { litres: 100, orders: 3 },
    orderedOils: { litres: 120, orders: 4 },
    oilsByBrand: [{ brand: "Fuchs", litres: 80, orders: 2 }],
    collections: { total: 5000, verified: 2000, pendingCount: 1, count: 4 },
    ...over,
  };
}

const subline = (cards: MetricCard[], key: string) => cards.find((c) => c.key === key)!.subline;

describe("buildMetricCards", () => {
  it("builds the fixed cards in order (Visits/Productive/Bearings removed)", () => {
    const keys = buildMetricCards(metrics()).map((c) => c.key);
    expect(keys).toEqual(["executives", "productivity", "ordered", "litres", "collections"]);
  });

  it("uses plural sublines for many, and a live-executive dataset", () => {
    const cards = buildMetricCards(metrics({ activeExecutives: { live: 2, total: 6 } }));
    expect(subline(cards, "productivity")).toBe("10 visits · 5 productive");
    expect(subline(cards, "ordered")).toBe("4 orders · incl. cancelled");
    expect(subline(cards, "litres")).toBe("3 deliveries · net of returns");
  });

  it("uses singular sublines for ones, and a no-live-executive dataset", () => {
    const cards = buildMetricCards(
      metrics({
        visits: 1,
        activeExecutives: { live: 0, total: 6 },
        orderedOils: { litres: 1, orders: 1 },
        sales: { litres: 1, orders: 1 },
      }),
    );
    expect(subline(cards, "productivity")).toBe("1 visit · 5 productive");
    expect(subline(cards, "ordered")).toBe("1 order · incl. cancelled");
    expect(subline(cards, "litres")).toBe("1 delivery · net of returns");
  });
});
