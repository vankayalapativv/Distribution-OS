import { afterEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ materializeTodayPlan: vi.fn().mockResolvedValue("bp-1"), bucketFromAge: vi.fn().mockReturnValue("0_30") }));
vi.mock("./beat-materialize", () => ({ materializeTodayPlan: h.materializeTodayPlan }));
vi.mock("./dues", () => ({ bucketFromAge: h.bucketFromAge }));

import { getTodayBeatPlan } from "./beats";
import { makeSql } from "../test/sql-mock";

afterEach(() => vi.clearAllMocks());

describe("getTodayBeatPlan", () => {
  it("returns no beat on Sunday", async () => {
    const sql = makeSql({ beat_today_ist: [{ weekday: 7, istDate: "2026-06-07" }] });
    const out = await getTodayBeatPlan(sql, { userId: "se-1" });
    expect(out).toMatchObject({ beatPlanId: null, stops: [] });
  });
  it("materializes and maps stops (string outstanding → num) on a weekday", async () => {
    const sql = makeSql({
      beat_today_ist: [{ weekday: 1, istDate: "2026-06-01" }],
      get_beat_plan_stops: [{ stopId: "st1", sequenceNo: 1, stopStatus: "pending", customerId: "c1", customerCode: "C1", legalName: "Ravi", outstanding: "100", ageDays: "10" }],
    });
    const out = await getTodayBeatPlan(sql, { userId: "se-1" });
    expect(out.beatPlanId).toBe("bp-1");
    expect(out.stops[0]).toMatchObject({ stopId: "st1", outstanding: 100, dueBucket: "0_30" });
  });
});
