import { describe, expect, it } from "vitest";
import { oilLeaderboard, oilSegmentLeaderboard } from "./leaderboard";
import { OIL_SEGMENTS } from "./targets";
import { makeSql } from "../test/sql-mock";

describe("oilLeaderboard", () => {
  it("maps each SE's today/week/month litres (numeric strings → numbers)", async () => {
    const sql = makeSql({
      leaderboard_oil_litres: [
        { userId: "se1", name: "Asha", today: "10.5", week: "40", month: "120" },
        { userId: "se2", name: "Ravi", today: 0, week: "0", month: "5" },
      ],
    });
    const rows = await oilLeaderboard(sql);
    expect(rows[0]).toEqual({ userId: "se1", name: "Asha", today: 10.5, week: 40, month: 120 });
    expect(rows[1]).toEqual({ userId: "se2", name: "Ravi", today: 0, week: 0, month: 5 });
  });
});

describe("oilSegmentLeaderboard", () => {
  it("pivots (SE, segment) rows into per-SE segment maps, ignoring unknown/null segments", async () => {
    const seg0 = OIL_SEGMENTS[0];
    const seg1 = OIL_SEGMENTS[1];
    const sql = makeSql({
      leaderboard_oil_segments: [
        { userId: "se1", name: "Asha", segment: seg0, today: "2", week: "5", month: "9" },
        { userId: "se1", name: "Asha", segment: seg1, today: "1", week: "1", month: "1" },
        { userId: "se1", name: "Asha", segment: "Retired", today: "99", week: "99", month: "99" },
        { userId: "se2", name: "Ravi", segment: null, today: "0", week: "0", month: "0" },
      ],
    });
    const rows = await oilSegmentLeaderboard(sql);
    expect(rows).toHaveLength(2);

    const asha = rows.find((r) => r.userId === "se1")!;
    expect(asha.today[seg0]).toBe(2);
    expect(asha.month[seg1]).toBe(1);
    // Every known segment is present and defaults to 0; the unknown one is dropped.
    expect(Object.keys(asha.today).sort()).toEqual([...OIL_SEGMENTS].sort());
    expect((asha.today as Record<string, number>).Retired).toBeUndefined();

    // An SE with only a null-segment row still appears, all-zero.
    const ravi = rows.find((r) => r.userId === "se2")!;
    expect(ravi.week[seg0]).toBe(0);
  });
});
