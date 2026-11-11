import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertDate,
  assertMonth,
  assertStatus,
  clearAttendance,
  getAttendanceGrid,
  getAttendanceSummary,
  getDailyAttendance,
  getMonthlyAttendance,
  setAttendance,
  thisMonthIst,
  todayIst,
} from "./attendance";
import { makeSql, calledTag } from "../test/sql-mock";

// 2026-06-15 06:00 UTC = 11:30 IST → todayIst() is "2026-06-15".
const pinToday = () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-15T06:00:00Z"));
};

afterEach(() => vi.useRealTimers());

describe("date helpers + validators", () => {
  it("todayIst / thisMonthIst read the IST clock", () => {
    pinToday();
    expect(todayIst()).toBe("2026-06-15");
    expect(thisMonthIst()).toBe("2026-06");
  });
  it("assertDate / assertMonth / assertStatus validate their inputs", () => {
    expect(assertDate("2026-06-15")).toBe("2026-06-15");
    expect(() => assertDate("2026/06/15")).toThrowError(/YYYY-MM-DD/);
    expect(assertMonth("2026-06")).toBe("2026-06");
    expect(() => assertMonth("2026-6")).toThrowError(/YYYY-MM/);
    expect(assertStatus("present")).toBe("present");
    expect(() => assertStatus("vacation")).toThrowError(/Invalid attendance status/);
  });
});

describe("getDailyAttendance", () => {
  it("rolls call with present derived from a start time", async () => {
    const sql = makeSql({
      attendance_daily: [
        { userId: "se-1", name: "Asha", startTime: new Date("2026-06-15T03:30:00Z"), endTime: new Date("2026-06-15T13:00:00Z"), startOdometer: "100", endOdometer: "150" },
        { userId: "se-2", name: "Ravi", startTime: null, endTime: null, startOdometer: null, endOdometer: "abc" },
      ],
    });
    const rows = await getDailyAttendance(sql, "2026-06-15");
    expect(rows[0]).toMatchObject({ present: true, startOdometer: 100, endOdometer: 150 });
    expect(rows[1]).toMatchObject({ present: false, startTime: null, startOdometer: null, endOdometer: null });
  });
});

describe("getMonthlyAttendance", () => {
  it("maps each started day (string start time, null/blank date tolerated)", async () => {
    const sql = makeSql({
      attendance_monthly: [
        { date: new Date("2026-06-10T00:00:00Z"), startTime: "2026-06-10T03:30:00Z", endTime: null, startOdometer: "100", endOdometer: null },
        { date: null, startTime: null, endTime: null, startOdometer: null, endOdometer: null },
      ],
    });
    const rows = await getMonthlyAttendance(sql, "se-1", "2026-06");
    expect(rows[0]).toMatchObject({ date: "2026-06-10", startTime: "2026-06-10T03:30:00Z", endTime: null });
    expect(rows[1]).toMatchObject({ date: "", startTime: "" });
  });
});

describe("getAttendanceGrid", () => {
  it("derives present/absent, honours overrides, and locks future days", async () => {
    pinToday();
    const sql = makeSql({
      attendance_grid_ses: [{ userId: "se-1", name: "Asha" }],
      attendance_grid_tracked: [
        { userId: "se-1", date: new Date("2026-06-10T00:00:00Z"), startTime: new Date("2026-06-10T03:30:00Z"), endTime: new Date("2026-06-10T13:00:00Z"), startOdometer: "100", endOdometer: "150" },
        // Worked a Sunday (2026-06-07) → present, not week_off.
        { userId: "se-1", date: new Date("2026-06-07T00:00:00Z"), startTime: new Date("2026-06-07T03:30:00Z"), endTime: null, startOdometer: "100", endOdometer: null },
        // Worked on a day also marked holiday (2026-06-11) → present wins.
        { userId: "se-1", date: new Date("2026-06-11T00:00:00Z"), startTime: new Date("2026-06-11T03:30:00Z"), endTime: null, startOdometer: "100", endOdometer: null },
      ],
      attendance_grid_overrides: [
        { userId: "se-1", date: new Date("2026-06-12T00:00:00Z"), status: "leave", note: "sick" },
        { userId: "se-1", date: new Date("2026-06-11T00:00:00Z"), status: "holiday", note: null }, // worked holiday → present
        { userId: "se-1", date: new Date("2026-06-13T00:00:00Z"), status: "holiday", note: "Festival" }, // unworked holiday
      ],
    });
    const grid = await getAttendanceGrid(sql, "2026-06");
    expect(grid.days).toHaveLength(30);
    const byDate = Object.fromEntries(grid.rows[0].days.map((c) => [c.date, c]));
    expect(byDate["2026-06-10"]).toMatchObject({ status: "present", tracked: true, manual: false });
    expect(byDate["2026-06-12"]).toMatchObject({ status: "leave", manual: true, note: "sick" });
    expect(byDate["2026-06-05"]).toMatchObject({ status: "absent", tracked: false });
    // Sundays: worked -> present, untracked -> the weekly off (not absent).
    expect(byDate["2026-06-07"]).toMatchObject({ status: "present", tracked: true, manual: false });
    expect(byDate["2026-06-14"]).toMatchObject({ status: "week_off", tracked: false, manual: false });
    // Holiday: unworked -> holiday (manual), worked that day -> present (work wins).
    expect(byDate["2026-06-13"]).toMatchObject({ status: "holiday", manual: true, note: "Festival" });
    expect(byDate["2026-06-11"]).toMatchObject({ status: "present", tracked: true, manual: false });
    expect(byDate["2026-06-20"]).toMatchObject({ status: null, manual: false }); // future → locked
  });
});

describe("setAttendance / clearAttendance", () => {
  const base = { userId: "se-1", date: "2026-06-10", status: "present" as const, note: null, updatedBy: "admin" };

  it("upserts a manual status for a valid, non-future SE day", async () => {
    pinToday();
    const sql = makeSql({ attendance_target_is_se: [{ id: "se-1" }] });
    await setAttendance(sql, base);
    expect(calledTag(sql, "attendance_upsert")).toBe(true);
  });

  it("rejects a future date (422)", async () => {
    pinToday();
    await expect(setAttendance(makeSql(), { ...base, date: "2026-07-01" })).rejects.toMatchObject({ status: 422 });
  });

  it("404s when the target is not an active SE", async () => {
    pinToday();
    await expect(setAttendance(makeSql({ attendance_target_is_se: [] }), base)).rejects.toMatchObject({ status: 404 });
  });

  it("clears a manual override", async () => {
    const sql = makeSql();
    await clearAttendance(sql, "se-1", "2026-06-10");
    expect(calledTag(sql, "attendance_clear")).toBe(true);
  });
});

describe("getAttendanceSummary", () => {
  it("computes days present, attendance %, avg hours/visits per person", async () => {
    const sql = makeSql({
      attendance_summary_bounds: [{ capped: new Date("2026-06-15T00:00:00Z") }],
      attendance_summary_roster: [
        { userId: "se-1", name: "Asha", role: "SALES_EXECUTIVE" },
        { userId: "log-1", name: "Ravi", role: "LOGISTICS" },
      ],
      attendance_summary_sessions: [
        // 10 days present, 1 of them a worked Sunday → denominator = 13 non-Sunday
        // days (June 1–15 has 2 Sundays: 7th, 14th) + 1 worked Sunday = 14.
        { userId: "se-1", daysPresent: 10, workedSundays: 1, avgHours: "8.5" },
        { userId: "log-1", daysPresent: null, workedSundays: null, avgHours: null }, // null daysPresent → n() 0 fallback
      ],
      attendance_summary_visits: [{ userId: "se-1", totalVisits: 20, avgMinutes: "25.4" }],
    });
    const { workingDays, rows } = await getAttendanceSummary(sql, "2026-06-01", "2026-06-30");
    expect(workingDays).toBe(15); // 1st → 15th inclusive (raw period length)
    const asha = rows.find((r) => r.userId === "se-1")!;
    expect(asha).toMatchObject({ daysPresent: 10, avgHoursPerDay: 8.5, avgVisitMinutes: 25, avgVisitsPerDay: 2 });
    // Sundays are weekly off: denominator = 13 non-Sunday days + 1 worked Sunday = 14.
    expect(asha.workingDays).toBe(14);
    expect(asha.attendancePct).toBeCloseTo(71.4, 1);
    const ravi = rows.find((r) => r.userId === "log-1")!;
    expect(ravi).toMatchObject({ daysPresent: 0, avgHoursPerDay: null, avgVisitMinutes: null, avgVisitsPerDay: null });
  });

  it("handles a string 'capped' bound and a zero working-day window (null %)", async () => {
    const sql = makeSql({
      attendance_summary_bounds: [{ capped: "2026-06-15" }], // string → the else branch
      attendance_summary_roster: [{ userId: "se-1", name: "Asha", role: "SALES_EXECUTIVE" }],
      attendance_summary_sessions: [],
      attendance_summary_visits: [],
    });
    const { workingDays, rows } = await getAttendanceSummary(sql, "2026-07-01", "2026-07-31");
    expect(workingDays).toBe(0); // capped (Jun 15) is before the from date
    expect(rows[0].attendancePct).toBeNull();
  });
});
