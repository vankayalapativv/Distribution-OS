import { describe, expect, it } from "vitest";
import { profitReport, parseProfitGroup } from "./profit";
import { makeSql, calledTag } from "../test/sql-mock";

describe("parseProfitGroup", () => {
  it("accepts the four groups, defaults everything else to invoice", () => {
    expect(parseProfitGroup("customer")).toBe("customer");
    expect(parseProfitGroup("sku")).toBe("sku");
    expect(parseProfitGroup("area")).toBe("area");
    expect(parseProfitGroup("invoice")).toBe("invoice");
    expect(parseProfitGroup("nonsense")).toBe("invoice");
    expect(parseProfitGroup(null)).toBe("invoice");
  });
});

describe("profitReport", () => {
  it("by invoice: expense share = units × (expenses ÷ units), profit = sold − expense − cost", async () => {
    const sql = makeSql({
      profit_expenses: [{ expenses: "1000" }],
      profit_base: [{ units: "100", sold: "5000", cost: "3000", unpricedLines: "0", invoices: "2" }],
      profit_by_invoice: [
        { key: "i1", label: "SA/1", sub: "Acme · 01 Apr 2026", units: "60", sold: "3000", cost: "1800", lines: "3", unpricedLines: "0" },
        { key: "i2", label: "SA/2", sub: "Beta · 02 Apr 2026", units: "40", sold: "2000", cost: "1200", lines: "2", unpricedLines: "1" },
      ],
    });
    const res = await profitReport(sql, { from: "2026-04-01", to: "2026-04-30" });
    expect(res.groupBy).toBe("invoice");
    // expPerUnit = 1000/100 = 10; whole pool allocated across sold units.
    expect(res.totals).toEqual({
      invoices: 2, units: 100, soldValue: 5000, cost: 3000, expenseValue: 1000, expenses: 1000,
      profit: 1000, marginPct: 20, expPerUnit: 10, unpricedLines: 0,
    });
    // i1: expense = 60×10 = 600; profit = 3000 − 600 − 1800 = 600; margin 20%.
    expect(res.rows[0]).toEqual({
      key: "i1", label: "SA/1", sub: "Acme · 01 Apr 2026",
      units: 60, soldValue: 3000, cost: 1800, expenseValue: 600, profit: 600, marginPct: 20, lines: 3, unpricedLines: 0,
    });
    expect(res.rows[1].unpricedLines).toBe(1);
    expect(calledTag(sql, "profit_by_invoice")).toBe(true);
  });

  it("routes each groupBy to its query and tolerates no sales (units 0 → no expense, null margin)", async () => {
    for (const [g, tag] of [["customer", "profit_by_customer"], ["sku", "profit_by_sku"], ["area", "profit_by_area"], ["weird", "profit_by_invoice"]] as const) {
      const sql = makeSql({
        profit_expenses: [{ expenses: "500" }],
        profit_base: [{ units: "0", sold: "0", cost: "0", unpricedLines: "0", invoices: "0" }],
      });
      const res = await profitReport(sql, { groupBy: g });
      expect(res.groupBy).toBe(g === "weird" ? "invoice" : g);
      expect(res.rows).toEqual([]);
      expect(res.totals.expPerUnit).toBe(0); // no units → no per-unit rate
      expect(res.totals.expenseValue).toBe(0); // nothing sold → nothing allocated
      expect(res.totals.marginPct).toBeNull();
      expect(calledTag(sql, tag)).toBe(true);
    }
  });

  it("formats group rows: blank label → dash, blank/null sub → null, zero-sold → null margin", async () => {
    const sql = makeSql({
      profit_expenses: [{ expenses: "50" }],
      profit_base: [{ units: "10", sold: "0", cost: "0", unpricedLines: "0", invoices: "1" }],
      profit_by_area: [
        { key: "", label: "", sub: "", units: "10", sold: "0", cost: "0", lines: "1", unpricedLines: "0" },
        { key: "(no city)", label: "(no city)", sub: null, units: "0", sold: "0", cost: "0", lines: "0", unpricedLines: "0" },
      ],
    });
    const res = await profitReport(sql, { groupBy: "area" });
    expect(res.rows[0].label).toBe("—"); // empty label → dash
    expect(res.rows[0].sub).toBeNull(); // empty-string sub → null
    expect(res.rows[0].marginPct).toBeNull(); // zero sold → no margin
    expect(res.rows[0].expenseValue).toBe(50); // 10 units × (50/10)
    expect(res.rows[1].sub).toBeNull(); // null sub → null
    expect(res.totals.marginPct).toBeNull();
  });
});
