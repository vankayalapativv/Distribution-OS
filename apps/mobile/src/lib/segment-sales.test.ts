import { describe, expect, it } from "vitest";
import { rankSegmentSales, type SegmentSalesRow } from "./segment-sales";

const segs = (p: Partial<Record<string, number>>) => ({
  Car: 0,
  "2W": 0,
  "3W": 0,
  Commercial: 0,
  Agri: 0,
  "Gear Oil": 0,
  Coolant: 0,
  Grease: 0,
  ...p,
}) as SegmentSalesRow["today"];

const row = (
  userId: string,
  name: string,
  periods: { today?: Partial<Record<string, number>>; week?: Partial<Record<string, number>>; month?: Partial<Record<string, number>> },
): SegmentSalesRow => ({
  userId,
  name,
  today: segs(periods.today ?? {}),
  week: segs(periods.week ?? {}),
  month: segs(periods.month ?? {}),
});

describe("rankSegmentSales", () => {
  const rows = [
    row("a", "Amar", { today: { Car: 100, "2W": 50 }, month: { Car: 300 } }),
    row("b", "Bhaskar", { today: { Car: 200, Agri: 20 }, month: { Car: 100, "3W": 60 } }),
    row("c", "Chandra", { today: {}, month: { Commercial: 40 } }), // no sales today
  ];

  it("ranks by period total, desc, and drops zero-total SEs", () => {
    const t = rankSegmentSales(rows, "today");
    expect(t.map((r) => [r.name, r.total, r.rank])).toEqual([
      ["Bhaskar", 220, 1],
      ["Amar", 150, 2],
    ]); // Chandra has 0 today → dropped
  });

  it("keeps the per-segment map for the selected period", () => {
    const [top] = rankSegmentSales(rows, "today");
    expect(top.bySegment.Car).toBe(200);
    expect(top.bySegment.Agri).toBe(20);
    expect(top.bySegment["2W"]).toBe(0);
  });

  it("recomputes ranking when the period changes", () => {
    const m = rankSegmentSales(rows, "month");
    expect(m.map((r) => r.name)).toEqual(["Amar", "Bhaskar", "Chandra"]); // 300 > 160 > 40
  });

  it("breaks ties by name", () => {
    const tie = [
      row("x", "Zoe", { today: { Car: 100 } }),
      row("y", "Ann", { today: { Car: 100 } }),
    ];
    expect(rankSegmentSales(tie, "today").map((r) => r.name)).toEqual(["Ann", "Zoe"]);
  });

  it("returns empty when nobody sold in the period", () => {
    expect(rankSegmentSales(rows, "week")).toEqual([]);
  });
});
