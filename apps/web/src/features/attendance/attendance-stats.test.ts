import { describe, expect, it } from "vitest";
import type { AttendanceCell, AttendanceGridRow, DailyAttendanceRow } from "./attendance-api";
import { cellHours, dailyKpis, gridKpis, odoDistance, rowTotals } from "./attendance-stats";

const cell = (over: Partial<AttendanceCell>): AttendanceCell => ({
  date: "2026-07-01", status: "present", manual: false, tracked: true,
  startTime: null, endTime: null, startOdometer: null, endOdometer: null, note: null, ...over,
});

describe("cellHours", () => {
  it("is the positive span in hours, else null", () => {
    expect(cellHours("2026-07-01T03:30:00Z", "2026-07-01T13:00:00Z")).toBeCloseTo(9.5);
    expect(cellHours("2026-07-01T03:30:00Z", null)).toBeNull();
    expect(cellHours(null, "2026-07-01T13:00:00Z")).toBeNull();
    expect(cellHours("2026-07-01T13:00:00Z", "2026-07-01T03:30:00Z")).toBeNull(); // negative
  });
});

describe("odoDistance", () => {
  it("is end − start when both exist and end ≥ start", () => {
    expect(odoDistance(1000, 1050)).toBe(50);
    expect(odoDistance(1000, null)).toBeNull();
    expect(odoDistance(1050, 1000)).toBeNull(); // rollback guarded
  });
});

const row: AttendanceGridRow = {
  userId: "u1",
  name: "Asha",
  days: [
    cell({ date: "2026-07-01", status: "present", startTime: "2026-07-01T03:30:00Z", endTime: "2026-07-01T13:00:00Z", startOdometer: 100, endOdometer: 160 }),
    cell({ date: "2026-07-02", status: "present", startTime: "2026-07-02T04:00:00Z", endTime: null }), // no end → no hours/km
    cell({ date: "2026-07-03", status: "half_day", startTime: "2026-07-03T03:30:00Z", endTime: "2026-07-03T08:30:00Z", startOdometer: 200, endOdometer: 230 }),
    cell({ date: "2026-07-04", status: "absent", tracked: false }),
    cell({ date: "2026-07-05", status: "leave", manual: true, tracked: false }),
    cell({ date: "2026-07-06", status: "week_off", tracked: false }),
    cell({ date: "2026-07-07", status: null, tracked: false }), // future
  ],
};

describe("rowTotals", () => {
  it("counts statuses and sums hours/km, excluding leave + week-off from the %", () => {
    const t = rowTotals(row);
    expect(t).toMatchObject({ present: 2, absent: 1, halfDay: 1, leave: 1, weekOff: 1, holiday: 0 });
    expect(t.hours).toBeCloseTo(14.5); // 9.5 + 5
    expect(t.km).toBe(90); // 60 + 30
    expect(t.attendancePct).toBeCloseTo(62.5); // (2 + 0.5) / 4
    // present / total: present days = 2 + 0.5·half = 2.5; total working days =
    // present + absent + half + leave = 5 (excludes week-off + holiday).
    expect(t.presentDays).toBe(2.5);
    expect(t.totalWorkingDays).toBe(5);
  });

  it("returns null % when no working day has been seen", () => {
    expect(rowTotals({ userId: "x", name: "X", days: [cell({ status: "week_off" })] }).attendancePct).toBeNull();
  });
});

describe("gridKpis", () => {
  const days = ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05", "2026-07-06", "2026-07-07"];

  it("derives today + month-to-date figures", () => {
    const k = gridKpis([row], days, "2026-07-01");
    expect(k.hasToday).toBe(true);
    expect(k.inToday).toBe(1);
    expect(k.absentToday).toBe(0);
    expect(k.onFieldNow).toBe(0); // today ended → not on field
    expect(k.kmToday).toBe(60);
    expect(k.attendancePct).toBeCloseTo(62.5);
    expect(k.avgHours).toBeCloseTo(7.25); // (9.5 + 5) / 2 days with hours
    expect(k.totalKm).toBe(90);
  });

  it("nulls the today metrics when today isn't in the shown month", () => {
    const k = gridKpis([row], days, "2026-08-15");
    expect(k.hasToday).toBe(false);
    expect(k.inToday).toBeNull();
    expect(k.attendancePct).toBeCloseTo(62.5); // MTD still computed
  });
});

describe("dailyKpis", () => {
  it("counts present / absent / on-field-now and total distance", () => {
    const rows: DailyAttendanceRow[] = [
      { userId: "u1", name: "Asha", startTime: "x", endTime: "y", startOdometer: 1000, endOdometer: 1050, present: true },
      { userId: "u2", name: "Ravi", startTime: "x", endTime: null, startOdometer: null, endOdometer: null, present: true },
      { userId: "u3", name: "Sunil", startTime: null, endTime: null, startOdometer: null, endOdometer: null, present: false },
    ];
    expect(dailyKpis(rows)).toEqual({ totalSe: 3, present: 2, absent: 1, weekOff: 0, onFieldNow: 1, totalKm: 50 });
    // On a Sunday the non-present SE is "week off", not "absent".
    expect(dailyKpis(rows, true)).toEqual({ totalSe: 3, present: 2, absent: 0, weekOff: 1, onFieldNow: 1, totalKm: 50 });
  });
});
