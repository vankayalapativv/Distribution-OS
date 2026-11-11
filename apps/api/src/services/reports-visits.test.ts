import { describe, expect, it } from "vitest";
import {
  buildCustomerProductivity,
  buildProductivityTrend,
  buildVisitsTrend,
  MIN_VISITS,
} from "./reports-visits";
import { makeSql } from "../test/sql-mock";

describe("buildProductivityTrend", () => {
  it("pivots per-exec monthly productivity %, sorts months + rows, and nulls 0-visit %", async () => {
    const sql = makeSql({
      reports_productivity_trend: [
        { se: "se-1", name: "Asha", month: "2026-06", visits: "10", productive: "6" },
        { se: "se-1", name: "Asha", month: "2026-05", visits: "0", productive: "0" }, // → pct null
        { se: "se-2", name: "Bravo", month: "2026-05", visits: "4", productive: "2" },
      ],
    });
    const out = await buildProductivityTrend(sql);
    expect(out.months).toEqual(["2026-05", "2026-06"]); // sorted
    expect(out.rows.map((r) => r.name)).toEqual(["Asha", "Bravo"]); // sorted by name
    const asha = out.rows[0];
    expect(asha.points.map((p) => p.month)).toEqual(["2026-05", "2026-06"]); // sorted
    expect(asha.points.find((p) => p.month === "2026-06")!.pct).toBe(60);
    expect(asha.points.find((p) => p.month === "2026-05")!.pct).toBeNull(); // 0 visits
  });
});

describe("buildVisitsTrend", () => {
  it("sums monthly org totals + grand total across execs", async () => {
    const sql = makeSql({
      reports_visits_trend: [
        { se: "se-1", name: "Asha", month: "2026-06", total: "10" },
        { se: "se-1", name: "Asha", month: "2026-05", total: "5" },
        { se: "se-2", name: "Bravo", month: "2026-06", total: "3" },
      ],
    });
    const out = await buildVisitsTrend(sql);
    expect(out.rows.find((r) => r.name === "Asha")!.total).toBe(15);
    expect(out.totals).toEqual([
      { month: "2026-05", total: 5 }, // Bravo absent that month → 0
      { month: "2026-06", total: 13 },
    ]);
    expect(out.grandTotal).toBe(18);
  });
});

describe("buildCustomerProductivity", () => {
  it("splits each exec's highest/lowest customers by rank and skips out-of-topN rows", async () => {
    const sql = makeSql({
      reports_customer_productivity: [
        { se: "se-1", name: "Asha", customer: "Ravi", visits: "5", productive: "5", hi: "1", lo: "3" },
        { se: "se-1", name: "Asha", customer: "Kumar", visits: "4", productive: "0", hi: "3", lo: "1" },
        { se: "se-1", name: "Asha", customer: "Ghost", visits: "3", productive: "1", hi: "11", lo: "11" }, // neither bucket
        // second exec forces the row sort; null customer/visits exercise str()/num() fallbacks
        { se: "se-2", name: "Bravo", customer: null, visits: null, productive: "1", hi: "1", lo: "1" },
      ],
    });
    const out = await buildCustomerProductivity(sql);
    expect(out).toMatchObject({ minVisits: MIN_VISITS, topN: 10 });
    expect(out.rows.map((r) => r.name)).toEqual(["Asha", "Bravo"]); // sorted
    const asha = out.rows[0];
    expect(asha.highest.map((e) => e.customer)).toEqual(["Ravi", "Kumar"]); // by hi rank
    expect(asha.lowest.map((e) => e.customer)).toEqual(["Kumar", "Ravi"]); // by lo rank
    expect(asha.highest.find((e) => e.customer === "Ravi")!.pct).toBe(100);
    expect(asha.highest.find((e) => e.customer === "Kumar")!.pct).toBe(0);
    // Ghost (out of top-N on both) appears in neither bucket.
    expect(asha.highest.some((e) => e.customer === "Ghost")).toBe(false);
    expect(asha.lowest.some((e) => e.customer === "Ghost")).toBe(false);
  });
});
