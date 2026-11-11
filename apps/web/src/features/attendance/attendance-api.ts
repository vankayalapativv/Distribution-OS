// SE attendance = the "Start day" GPS session. Data is fetched client-side via
// TanStack Query (apiGet); the server page only supplies actionConfig.

export interface DailyAttendanceRow {
  userId: string;
  name: string;
  startTime: string | null; // ISO of earliest start that day, or null when absent
  endTime: string | null; // ISO of the manual "End day" tap, or null if not ended that way
  startOdometer: number | null; // whole-km reading at Start day, or null
  endOdometer: number | null; // whole-km reading at the manual End day, or null
  present: boolean;
}

export interface DailyAttendanceResponse {
  date: string;
  rows: DailyAttendanceRow[];
  summary: { total: number; present: number; absent: number };
}

export interface MonthlyAttendanceDay {
  date: string; // YYYY-MM-DD
  startTime: string; // ISO
  endTime: string | null; // ISO of the manual "End day" tap that day, else null
  startOdometer: number | null;
  endOdometer: number | null;
}

export interface MonthlyAttendanceResponse {
  userId: string;
  month: string;
  days: MonthlyAttendanceDay[];
}

export interface SalesExecutive {
  id: string;
  name: string;
}

export type AttendanceStatus = "present" | "absent" | "half_day" | "leave" | "week_off" | "holiday";

export interface AttendanceCell {
  date: string; // YYYY-MM-DD
  status: AttendanceStatus | null; // null = future/locked
  manual: boolean; // set by a Super Admin (vs derived from tracking)
  tracked: boolean; // SE had a Start-day session that day
  startTime: string | null; // ISO of earliest start that day, or null
  endTime: string | null; // ISO of the manual "End day" tap that day, or null
  startOdometer: number | null; // whole-km reading at Start day, or null
  endOdometer: number | null; // whole-km reading at the manual End day, or null
  note: string | null;
}

export interface AttendanceGridRow {
  userId: string;
  name: string;
  days: AttendanceCell[];
}

export interface AttendanceGridResponse {
  month: string;
  days: string[]; // YYYY-MM-DD for each day of the month
  rows: AttendanceGridRow[];
}

/** Status display metadata — label + tone, shared by the grid + its legend. */
export const ATTENDANCE_STATUS_META: Record<
  AttendanceStatus,
  { label: string; short: string; cell: string }
> = {
  present: { label: "Present", short: "P", cell: "bg-green-100 text-green-700" },
  absent: { label: "Absent", short: "A", cell: "bg-red-100 text-red-700" },
  half_day: { label: "Half day", short: "H", cell: "bg-amber-100 text-amber-800" },
  leave: { label: "Leave", short: "L", cell: "bg-indigo-100 text-indigo-700" },
  week_off: { label: "Week-off", short: "W", cell: "bg-slate-100 text-slate-500" },
  holiday: { label: "Holiday", short: "Ho", cell: "bg-purple-100 text-purple-700" },
};

export const ATTENDANCE_STATUS_ORDER: AttendanceStatus[] = [
  "present",
  "absent",
  "half_day",
  "leave",
  "week_off",
  "holiday",
];

export function getActionConfig(): { apiBaseUrl: string } {
  return {
    apiBaseUrl: process.env.DISTRIBUTION_OS_API_BASE_URL ?? "http://localhost:8787/api/v1",
  };
}
