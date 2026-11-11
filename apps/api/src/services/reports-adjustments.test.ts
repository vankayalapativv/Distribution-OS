import { describe, expect, it } from "vitest";
import { buildCancelled, buildReturned } from "./reports-adjustments";
import { makeSql } from "../test/sql-mock";

const START = "2026-06-01";
const END = "2026-06-30";

describe("buildCancelled", () => {
  it("pivots partial/full litres per SE × segment, attaches % of gross ordered, drops empties", async () => {
    const sql = makeSql({
      reports_cancelled_oils: [
        { se: "se1", name: "Asha", segment: "Car", kind: "full", litres: "40" },
        { se: "se1", name: "Asha", segment: "Car", kind: "partial", litres: "10" },
        { se: "se1", name: "Asha", segment: "2W", kind: "full", litres: "20" },
        { se: "se2", name: "Ravi", segment: "Car", kind: "full", litres: "5" },
        // dropped: null/empty se, empty segment, zero/null litres
        { se: null, name: "X", segment: "Car", kind: "full", litres: "99" },
        { se: "", name: "X", segment: "Car", kind: "full", litres: "99" },
        { se: "se2", name: "Ravi", segment: "", kind: "full", litres: "7" },
        { se: "se2", name: "Ravi", segment: "Car", kind: "partial", litres: "0" },
        { se: "se2", name: "Ravi", segment: "Car", kind: "full", litres: null },
      ],
      reports_adj_gross_ordered: [
        { se: "se1", litres: "140" },
        { se: "se2", litres: "10" },
      ],
    });
    const rep = await buildCancelled(sql, START, END, null);
    // se1 total = 40+10+20 = 70 of 140 ordered = 50%
    const asha = rep.oils[0];
    expect(asha.userId).toBe("se1");
    expect(asha.full.Car).toBe(40);
    expect(asha.partial.Car).toBe(10);
    expect(asha.total).toBe(70);
    expect(asha.percent).toBe(50);
    // sorted by total desc — se1 (70) before se2 (5)
    expect(rep.oils.map((r) => r.userId)).toEqual(["se1", "se2"]);
    expect(rep.segments).toEqual(expect.arrayContaining(["Car", "2W"]));
  });

  it("filters by brand and tolerates no rows", async () => {
    const sql = makeSql({ reports_cancelled_oils: [], reports_adj_gross_ordered: [] });
    const rep = await buildCancelled(sql, START, END, "Fuchs");
    expect(rep).toEqual({ segments: [], oils: [] });
    const call = sql.calls.find((c) => c.tag === "reports_cancelled_oils")!;
    expect(call.params).toContain("Fuchs");
  });
});

describe("buildReturned", () => {
  it("assembles returned litres with a null gross-ordered map → 0%", async () => {
    const sql = makeSql({
      reports_returned_oils: [{ se: "se1", name: "Asha", segment: "Car", kind: "full", litres: "12" }],
      reports_adj_gross_ordered: [], // no gross → orderedLitres 0 → percent 0
    });
    const rep = await buildReturned(sql, START, END, null);
    expect(rep.oils[0]).toMatchObject({ total: 12, orderedLitres: 0, percent: 0 });
  });

  it("falls back to 'Unassigned' when the SE name is blank", async () => {
    const sql = makeSql({
      reports_returned_oils: [{ se: "se9", name: "", segment: "2W", kind: "partial", litres: "3" }],
      reports_adj_gross_ordered: [{ se: "se9", litres: "3" }],
    });
    const rep = await buildReturned(sql, START, END, null);
    expect(rep.oils[0].name).toBe("Unassigned");
    expect(rep.oils[0].percent).toBe(100);
  });
});
