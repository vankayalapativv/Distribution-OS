import { describe, expect, test } from "vitest";
import { computeMargin } from "./margin-calc";

/**
 * Fixtures are real columns from the client's margin_simulator.xlsx, so this
 * asserts the port reproduces the sheet cell-for-cell.
 */
describe("computeMargin (matches margin_simulator.xlsx)", () => {
  test("column B — 5w30 SP, 1 L", () => {
    const r = computeMargin({ packSize: 1, dlp: 366, expensePerLiter: 65, mop: 550, schemePerLiter: 70 });
    expect(r.totalExpense).toBe(65);
    expect(r.totalCost).toBe(431);
    expect(r.schemeTotal).toBe(70);
    expect(r.netRealization).toBe(480);
    expect(r.marginPerPack).toBe(49);
    expect(r.marginPerLiter).toBe(49);
  });

  test("column C — 5w30 SP, 3 L (fractional per-litre)", () => {
    const r = computeMargin({ packSize: 3, dlp: 922, expensePerLiter: 65, mop: 1526, schemePerLiter: 70 });
    expect(r.totalExpense).toBe(195);
    expect(r.totalCost).toBe(1117);
    expect(r.schemeTotal).toBe(210);
    expect(r.netRealization).toBe(1316);
    expect(r.marginPerPack).toBe(199);
    expect(r.marginPerLiter).toBeCloseTo(66.3333, 3);
  });

  test("column Q — UTTO GL4, 5 L (thin margin)", () => {
    const r = computeMargin({ packSize: 5, dlp: 1294, expensePerLiter: 65, mop: 1771, schemePerLiter: 30 });
    expect(r.marginPerPack).toBe(2);
    expect(r.marginPerLiter).toBeCloseTo(0.4, 6);
  });

  test("column R — UTTO GL4, 20 L", () => {
    const r = computeMargin({ packSize: 20, dlp: 5184, expensePerLiter: 65, mop: 7198, schemePerLiter: 30 });
    expect(r.totalExpense).toBe(1300);
    expect(r.totalCost).toBe(6484);
    expect(r.netRealization).toBe(6598);
    expect(r.marginPerPack).toBe(114);
    expect(r.marginPerLiter).toBe(5.7);
  });

  test("guards divide-by-zero when pack size is 0", () => {
    const r = computeMargin({ packSize: 0, dlp: 100, expensePerLiter: 65, mop: 200, schemePerLiter: 30 });
    expect(r.marginPerLiter).toBe(0);
  });
});
