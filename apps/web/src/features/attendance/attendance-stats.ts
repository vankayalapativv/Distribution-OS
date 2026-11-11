// Pure attendance aggregation — hours, distance, per-SE totals, and the KPI
// figures. Everything is derived from the /attendance/grid + /attendance/daily
// responses the API already returns, so no new endpoint is needed. Kept pure so
// it unit-tests without rendering.

import type { AttendanceGridRow, DailyAttendanceRow } from "./attendance-api";

/** Hours between start and end ISO timestamps, or null if either is missing or non-positive. */
export function cellHours(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const h = (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000;
  return Number.isFinite(h) && h > 0 ? h : null;
}

/** Distance travelled = end − start odometer, when both exist and end ≥ start. */
export function odoDistance(start: number | null, end: number | null): number | null {
  if (start == null || end == null) return null;
  const d = end - start;
  return d >= 0 ? d : null;
}

export interface RowTotals {
  present: number;
  absent: number;
  halfDay: number;
  leave: number;
  weekOff: number;
  holiday: number;
  /** Present days credited: full present + ½·half-day. */
  presentDays: number;
  /** Total working days = present + absent + half + leave (excludes week-off +
   *  holiday; = elapsed days − Sundays − holidays; leave stays in). */
  totalWorkingDays: number;
  /** Summed on-field hours for days where both start and end are known. */
  hours: number;
  /** Summed odometer distance for days where both readings are known. */
  km: number;
  /** (present + ½·half) ÷ working days excluding leave, as a %, or null if no base yet. */
  attendancePct: number | null;
}

/** Month totals for one SE row. Week-offs and future (null) days are excluded from the base. */
export function rowTotals(row: AttendanceGridRow): RowTotals {
  let present = 0,
    absent = 0,
    halfDay = 0,
    leave = 0,
    weekOff = 0,
    holiday = 0,
    hours = 0,
    km = 0;
  for (const c of row.days) {
    switch (c.status) {
      case "present":
        present += 1;
        break;
      case "absent":
        absent += 1;
        break;
      case "half_day":
        halfDay += 1;
        break;
      case "leave":
        leave += 1;
        break;
      case "week_off":
        weekOff += 1;
        break;
      case "holiday":
        holiday += 1;
        break;
      default:
        break; // null = future / locked
    }
    const h = cellHours(c.startTime, c.endTime);
    if (h != null) hours += h;
    const d = odoDistance(c.startOdometer, c.endOdometer);
    if (d != null) km += d;
  }
  const presentDays = present + 0.5 * halfDay;
  // Total working days = elapsed days − Sundays − holidays (leave stays in).
  const totalWorkingDays = present + absent + halfDay + leave;
  const base = present + absent + halfDay; // legacy % base (excludes leave + week-off)
  const attendancePct = base > 0 ? (presentDays / base) * 100 : null;
  return { present, absent, halfDay, leave, weekOff, holiday, presentDays, totalWorkingDays, hours, km, attendancePct };
}

export interface GridKpis {
  totalSe: number;
  /** today column present + half-day (null when today isn't in the shown month). */
  inToday: number | null;
  absentToday: number | null;
  /** Started their day today and haven't ended it yet. */
  onFieldNow: number | null;
  kmToday: number;
  /** Month-to-date present days (present + ½·half), aggregated across all SEs. */
  presentDays: number;
  /** Month-to-date total working days, aggregated across all SEs. */
  totalWorkingDays: number;
  /** Month-to-date attendance %, aggregated across all SEs. */
  attendancePct: number | null;
  /** Average on-field hours per present/half day that has an end time. */
  avgHours: number | null;
  totalKm: number;
  hasToday: boolean;
}

/** Month-to-date totals across all SEs: attendance base/credit, hours, and distance. */
function monthToDate(rows: AttendanceGridRow[]) {
  let credit = 0,
    base = 0,
    totalWorking = 0,
    hours = 0,
    hourDays = 0,
    totalKm = 0;
  for (const row of rows) {
    const t = rowTotals(row);
    credit += t.presentDays;
    base += t.present + t.absent + t.halfDay;
    totalWorking += t.totalWorkingDays;
    totalKm += t.km;
    for (const c of row.days) {
      const h = cellHours(c.startTime, c.endTime);
      if (h != null && (c.status === "present" || c.status === "half_day")) {
        hours += h;
        hourDays += 1;
      }
    }
  }
  return { credit, base, totalWorking, hours, hourDays, totalKm };
}

/** Today's column across all SEs: who's in, absent, still on field, and km so far. */
function todayColumn(rows: AttendanceGridRow[], todayIdx: number) {
  let inToday = 0,
    absentToday = 0,
    onFieldNow = 0,
    kmToday = 0;
  for (const row of rows) {
    const c = row.days[todayIdx];
    if (c.status === "present" || c.status === "half_day") {
      inToday += 1;
      if (c.tracked && !c.endTime) onFieldNow += 1;
    } else if (c.status === "absent") {
      absentToday += 1;
    }
    const d = odoDistance(c.startOdometer, c.endOdometer);
    if (d != null) kmToday += d;
  }
  return { inToday, absentToday, onFieldNow, kmToday };
}

/** The headline figures for the monthly grid. `today` is YYYY-MM-DD (IST). */
export function gridKpis(rows: AttendanceGridRow[], days: string[], today: string): GridKpis {
  const todayIdx = days.indexOf(today);
  const hasToday = todayIdx >= 0;
  const mtd = monthToDate(rows);
  const tc = hasToday ? todayColumn(rows, todayIdx) : null;

  return {
    totalSe: rows.length,
    inToday: tc ? tc.inToday : null,
    absentToday: tc ? tc.absentToday : null,
    onFieldNow: tc ? tc.onFieldNow : null,
    kmToday: tc ? tc.kmToday : 0,
    presentDays: mtd.credit,
    totalWorkingDays: mtd.totalWorking,
    attendancePct: mtd.base > 0 ? (mtd.credit / mtd.base) * 100 : null,
    avgHours: mtd.hourDays > 0 ? mtd.hours / mtd.hourDays : null,
    totalKm: mtd.totalKm,
    hasToday,
  };
}

export interface DailyKpis {
  totalSe: number;
  present: number;
  absent: number;
  weekOff: number;
  onFieldNow: number;
  totalKm: number;
}

/** Headline figures for the daily view, from the /attendance/daily rows. */
export function dailyKpis(rows: DailyAttendanceRow[], sunday = false): DailyKpis {
  let present = 0,
    onFieldNow = 0,
    totalKm = 0;
  for (const r of rows) {
    if (r.present) {
      present += 1;
      if (!r.endTime) onFieldNow += 1;
    }
    const d = odoDistance(r.startOdometer, r.endOdometer);
    if (d != null) totalKm += d;
  }
  // Sunday is the weekly off: SEs who didn't start their day are "week off", not
  // "absent" (a worked Sunday still counts as present).
  const notPresent = rows.length - present;
  return {
    totalSe: rows.length,
    present,
    absent: sunday ? 0 : notPresent,
    weekOff: sunday ? notPresent : 0,
    onFieldNow,
    totalKm,
  };
}
