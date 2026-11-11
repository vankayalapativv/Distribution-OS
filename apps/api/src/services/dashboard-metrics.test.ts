import { describe, expect, it } from "vitest";
import {
  assertMetric,
  assertValidRange,
  getDashboardMetrics,
  getMetricAgentCustomers,
  getMetricAgents,
} from "./dashboard-metrics";
import { makeSql } from "../test/sql-mock";

const CTX = { userId: "u1", role: "SUPER_ADMIN" } as never;
const RANGE = { from: "2026-06-01", to: "2026-06-30" };

describe("assertValidRange / assertMetric", () => {
  it("rejects bad dates, reversed ranges, and unknown metrics", () => {
    expect(() => assertValidRange({ from: "2026/06/01", to: "2026-06-30" })).toThrowError(/YYYY-MM-DD/);
    expect(() => assertValidRange({ from: "2026-06-30", to: "2026-06-01" })).toThrowError(/must not be after/);
    expect(assertMetric("visits")).toBe("visits");
    expect(() => assertMetric("bogus")).toThrowError(/Unknown metric/);
  });
});

describe("getDashboardMetrics", () => {
  it("assembles headline metrics incl. oils-by-brand (null numeric → 0)", async () => {
    const sql = makeSql({
      metrics_executives: [{ live: null, total: "5" }], // null → num() 0 fallback
      metrics_visits: [{ visits: "20", productiveVisits: "12" }],
      metrics_ordered: [{ litres: "100", orders: "4" }],
      metrics_delivered: [{ litres: "80", deliveries: "3" }],
      metrics_oils_by_brand: [{ brand: "Fuchs", litres: "60", orders: "2" }],
      metrics_collections: [{ total: "9000", verified: "7000", pendingCount: "1", count: "3" }],
    });
    const out = await getDashboardMetrics(sql, CTX, RANGE);
    expect(out.activeExecutives).toEqual({ live: 0, total: 5 });
    expect(out.oilsByBrand).toEqual([{ brand: "Fuchs", litres: 60, orders: 2 }]);
    expect(out.sales).toEqual({ litres: 80, orders: 3 });
  });
});

describe("getMetricAgents — every metric branch", () => {
  const cases: Record<string, Record<string, Record<string, unknown>[]>> = {
    executives: { agents_executives: [{ agentId: "se-1", agentName: "Asha" }] },
    visits: { agents_visits: [{ agentId: "se-1", agentName: "Asha", visits: 5, productiveVisits: 3, customers: 4, avgDuration: "20" }] },
    productive: { agents_visits: [{ agentId: "se-1", agentName: "Asha", visits: 5, productiveVisits: 3, customers: 4, avgDuration: null }] },
    productivity: {
      agents_visits: [
        { agentId: "se-1", agentName: "Asha", visits: 10, productiveVisits: 8, customers: 4, avgDuration: "20" },
        { agentId: "se-2", agentName: "Bravo", visits: 10, productiveVisits: 2, customers: 4, avgDuration: "15" },
      ],
    },
    ordered: { agents_ordered: [{ agentId: "se-1", agentName: "Asha", litres: "40", orders: "2" }] },
    litres: {
      agents_delivered: [
        { agentId: "se-1", agentName: "Asha", litres: "30", orders: "2", customers: "3" },
        { agentId: "se-2", agentName: "Bravo", litres: "50", orders: "1", customers: "2" }, // forces the litres sort
      ],
    },
    collections: { agents_collections: [{ agentId: "se-1", agentName: "Asha", total: "5000", verified: "4000", count: "2" }] },
  };

  for (const [metric, tags] of Object.entries(cases)) {
    it(`handles metric="${metric}"`, async () => {
      const rows = await getMetricAgents(makeSql(tags), CTX, metric as never, RANGE);
      expect(Array.isArray(rows)).toBe(true);
    });
  }

  it("ranks the productivity drill-down by productive ratio", async () => {
    const rows = (await getMetricAgents(makeSql(cases.productivity), CTX, "productivity" as never, RANGE)) as { agentName: string }[];
    expect(rows[0].agentName).toBe("Asha"); // 0.8 ratio before Bravo's 0.2
  });
});

describe("getMetricAgentCustomers — every metric branch", () => {
  const cases: Record<string, Record<string, Record<string, unknown>[]>> = {
    executives: { agent_day_timeline: [{ day: "2026-06-01" }] },
    visits: {
      agent_customer_visits: [
        // orders/collections arrays exercise the nested .map() callbacks
        { customerId: "c1", customerName: "Ravi", visits: 3, productive: true, orders: [{ id: "o1", code: "ORD-1", litres: "10" }], collections: [{ id: "col1", code: "COLL-1", amount: "500" }] },
      ],
    },
    productive: { agent_customer_visits: [{ customerId: "c1", customerName: "Ravi", visits: 3, productive: true }] },
    ordered: { agent_customer_ordered: [{ customerId: "c1", customerName: "Ravi", litres: "20", orders: "1" }] },
    litres: { agent_customer_delivered: [{ customerId: "c1", customerName: "Ravi", litres: "15", deliveries: "1" }] },
    collections: { agent_customer_collections: [{ customerId: "c1", customerName: "Ravi", total: "500", verified: "500", count: "1" }] },
  };

  for (const [metric, tags] of Object.entries(cases)) {
    it(`handles metric="${metric}"`, async () => {
      const out = await getMetricAgentCustomers(makeSql(tags), CTX, metric as never, "se-1", RANGE);
      expect(out).toBeDefined();
    });
  }
});
