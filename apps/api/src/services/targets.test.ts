import { describe, expect, it } from "vitest";
import { getMyPerformance, listExecutiveTargets, upsertTarget } from "./targets";
import { makeSql } from "../test/sql-mock";

const SE = "se-1";
const CTX = { userId: "admin-1" };
const PERIODS = [{ today: "2026-06-15", weekStart: "2026-06-15", monthStart: "2026-06-01" }];

describe("getMyPerformance", () => {
  it("returns today + week/month actuals with per-segment targets", async () => {
    const sql = makeSql({
      targets_oil_actuals_by_segment: [
        { segment: "Car", todayLitres: "5", weekLitres: "20", monthLitres: "60" },
        { segment: "", todayLitres: "99", weekLitres: "99", monthLitres: "99" }, // blank → skipped
      ],
      targets_collection_actuals: [
        { todayTotal: "1000", todayVerified: "800", weekTotal: "5000", weekVerified: "4000", monthTotal: "9000", monthVerified: "7000" },
      ],
      targets_current_periods: PERIODS,
      get_current_targets: [
        { periodType: "week", segment: "Car", litres: "25" },
        { periodType: "month", segment: "Car", litres: "100" },
        { periodType: "month", segment: "", litres: "5" }, // blank segment skipped
      ],
    });
    const perf = await getMyPerformance(sql, { userId: SE });
    expect(perf.today.date).toBe("2026-06-15");
    expect(perf.today.oilActual.find((s) => s.segment === "Car")!.litres).toBe(5);
    expect(perf.today.collections).toEqual({ total: 1000, verified: 800 });
    expect(perf.week.periodStart).toBe("2026-06-15");
    expect(perf.week.oilTarget!.find((s) => s.segment === "Car")!.litres).toBe(25);
    expect(perf.month.oilTarget!.find((s) => s.segment === "Car")!.litres).toBe(100);
  });

  it("returns null targets when none are saved and zeroes a missing collection row", async () => {
    const sql = makeSql({
      targets_oil_actuals_by_segment: [],
      targets_collection_actuals: [],
      targets_current_periods: PERIODS,
      get_current_targets: [],
    });
    const perf = await getMyPerformance(sql, { userId: SE });
    expect(perf.week.oilTarget).toBeNull();
    expect(perf.month.oilTarget).toBeNull();
    expect(perf.today.collections).toEqual({ total: 0, verified: 0 });
    expect(perf.today.oilActual).toHaveLength(8); // all canonical segments, zeroed
  });
});

describe("listExecutiveTargets", () => {
  it("lists all active SEs for the current period (target vs actual)", async () => {
    const sql = makeSql({
      targets_current_periods: PERIODS,
      list_target_ses: [{ id: SE, name: "Asha" }, { id: "se-2", name: "Ravi" }],
      targets_all_for_period: [{ userId: SE, name: "Asha", segment: "Car", litres: "30" }],
      targets_period_oil_by_user: [{ userId: SE, segment: "Car", litres: "12" }],
    });
    const res = await listExecutiveTargets(sql, { periodType: "month" });
    expect(res.period).toMatchObject({ isCurrent: true, isFuture: false, canEdit: true, periodStart: "2026-06-01" });
    expect(res.executives).toHaveLength(2);
    const asha = res.executives.find((e) => e.userId === SE)!;
    expect(asha.perf.oilActual.find((s) => s.segment === "Car")!.litres).toBe(12);
    expect(asha.perf.oilTarget!.find((s) => s.segment === "Car")!.litres).toBe(30);
    expect(asha.currentTarget).not.toBeNull();
  });

  it("handles a current WEEK period (week end-date branch) and a null SE name", async () => {
    const sql = makeSql({
      targets_current_periods: PERIODS,
      list_target_ses: [{ id: SE, name: null }], // null name → str() "" fallback
      targets_all_for_period: [],
      targets_period_oil_by_user: [],
    });
    const res = await listExecutiveTargets(sql, { periodType: "week" });
    expect(res.period).toMatchObject({ periodType: "week", periodStart: "2026-06-15", isCurrent: true });
    expect(res.executives[0]).toMatchObject({ userId: SE, name: "", currentTarget: null });
  });

  it("treats a future period as target-only (no actuals) and still editable", async () => {
    const sql = makeSql({
      targets_current_periods: PERIODS,
      list_target_ses: [{ id: SE, name: "Asha" }],
      target_period_start: [{ s: "2026-12-01" }],
      targets_all_for_period: [{ userId: SE, name: "Asha", segment: "Car", litres: "40" }],
      targets_period_oil_by_user: [{ userId: SE, segment: "Car", litres: "999" }], // must be ignored (future)
    });
    const res = await listExecutiveTargets(sql, { periodType: "month", periodStart: "2026-12-10" });
    expect(res.period).toMatchObject({ isFuture: true, canEdit: true, periodStart: "2026-12-01" });
    // Future → actuals are empty regardless of what the query would return.
    expect(res.executives[0].perf.oilActual.every((s) => s.litres === 0)).toBe(true);
  });

  it("rosters a past period from its targets only (read-only)", async () => {
    const sql = makeSql({
      targets_current_periods: PERIODS,
      list_target_ses: [{ id: "unused", name: "Unused" }],
      target_period_start: [{ s: "2026-01-01" }],
      targets_all_for_period: [{ userId: SE, name: "Asha", segment: "Car", litres: "15" }],
      targets_period_oil_by_user: [{ userId: SE, segment: "Car", litres: "10" }],
    });
    const res = await listExecutiveTargets(sql, { periodType: "month", periodStart: "2026-01-15" });
    expect(res.period).toMatchObject({ isCurrent: false, isFuture: false, canEdit: false });
    // Only SEs that had a target appear — not the active roster.
    expect(res.executives.map((e) => e.userId)).toEqual([SE]);
  });
});

describe("upsertTarget", () => {
  const INPUT = { periodType: "month" as const, periodDate: "2026-06-01", segments: [{ segment: "Car", litres: 100 }] };
  const ok = {
    target_user_exists: [{ id: SE, name: "Asha" }],
    target_period_guard: [{ start: "2026-06-01", current: "2026-06-01" }],
    upsert_se_target: [{ id: "t1", periodType: "month", periodStart: "2026-06-01" }],
    upsert_segment_targets: [],
  };

  it("upserts the segment targets and echoes the saved shape", async () => {
    const out = await upsertTarget(makeSql(ok), CTX, SE, INPUT);
    expect(out).toMatchObject({ userId: SE, seName: "Asha", periodType: "month", periodStart: "2026-06-01" });
    expect(out.segments.find((s) => s.segment === "Car")!.litres).toBe(100);
  });

  it("rejects a bad period type, unknown segment, or negative litres (422)", async () => {
    await expect(upsertTarget(makeSql(ok), CTX, SE, { ...INPUT, periodType: "day" as never })).rejects.toMatchObject({ status: 422 });
    await expect(upsertTarget(makeSql(ok), CTX, SE, { ...INPUT, segments: [{ segment: "Nope", litres: 1 }] })).rejects.toMatchObject({ status: 422 });
    await expect(upsertTarget(makeSql(ok), CTX, SE, { ...INPUT, segments: [{ segment: "Car", litres: -1 }] })).rejects.toMatchObject({ status: 422 });
  });

  it("404s when the target user is not a sales executive", async () => {
    await expect(upsertTarget(makeSql({ target_user_exists: [] }), CTX, SE, INPUT)).rejects.toMatchObject({ status: 404 });
  });

  it("rejects setting a target for a past period (422)", async () => {
    const sql = makeSql({ ...ok, target_period_guard: [{ start: "2026-01-01", current: "2026-06-01" }] });
    await expect(upsertTarget(sql, CTX, SE, INPUT)).rejects.toMatchObject({ status: 422 });
  });
});
