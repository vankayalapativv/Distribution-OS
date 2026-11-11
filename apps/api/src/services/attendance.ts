import type { SqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";

// SE attendance = the "Start day" GPS tracking session. The earliest
// started_at on a session_date is when the SE began their day (a user can
// occasionally open more than one session in a day). Read-only; IST throughout.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

/** Today's date (YYYY-MM-DD) in IST — the field team's day, not UTC's. */
export function todayIst(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

/** Current month (YYYY-MM) in IST. */
export function thisMonthIst(): string {
  return todayIst().slice(0, 7);
}

export function assertDate(date: string): string {
  if (!DATE_RE.test(date)) throw new ApiError("INVALID_FIELD", "date must be YYYY-MM-DD.", 422);
  return date;
}

export function assertMonth(month: string): string {
  if (!MONTH_RE.test(month)) throw new ApiError("INVALID_FIELD", "month must be YYYY-MM.", 422);
  return month;
}

/** timestamptz → ISO string (client formats to IST clock time); null passes through. */
function iso(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string" && v) return v;
  return null;
}

/** date column → YYYY-MM-DD (Neon returns date as a JS Date). */
function dateStr(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") return v.slice(0, 10);
  return "";
}

export interface DailyAttendanceRow {
  userId: string;
  name: string;
  startTime: string | null; // ISO of earliest started_at that day, or null when absent
  endTime: string | null; // ISO of the day's manual "End day" tap, or null if not ended that way
  startOdometer: number | null; // whole-km reading entered at Start day, or null
  endOdometer: number | null; // whole-km reading entered at the manual End day, or null
  present: boolean;
}

/** PostgreSQL integer → number, or null. */
function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** True when a YYYY-MM-DD business date is a Sunday — the default weekly off.
 *  A worked Sunday (a tracking session that day) still reads as present; an
 *  untracked Sunday defaults to week_off instead of absent. The date is already
 *  the IST business date, so its weekday is tz-independent via UTC. */
function isSunday(ymd: string): boolean {
  return new Date(`${ymd}T00:00:00Z`).getUTCDay() === 0;
}

/**
 * Daily roll-call: every active Sales Executive for `date`, with their
 * start-day time and (when they pressed "End day") their end time. SEs with no
 * session that day are returned present:false. End time is strictly the manual
 * End tap — a day closed by the midnight cap shows no end time.
 */
export async function getDailyAttendance(sql: SqlClient, date: string): Promise<DailyAttendanceRow[]> {
  const rows = (await sql`
    /* attendance_daily */
    select
      u.id as "userId",
      u.name,
      (
        select min(g.started_at)
        from gps_tracking_sessions g
        where g.user_id = u.id and g.session_date = ${date}::date
      ) as "startTime",
      (
        select max(g.ended_at)
        from gps_tracking_sessions g
        where g.user_id = u.id and g.session_date = ${date}::date
          and g.ended_reason = 'manual'
      ) as "endTime",
      (
        select g.start_odometer
        from gps_tracking_sessions g
        where g.user_id = u.id and g.session_date = ${date}::date
          and g.start_odometer is not null
        order by g.started_at asc
        limit 1
      ) as "startOdometer",
      (
        select g.end_odometer
        from gps_tracking_sessions g
        where g.user_id = u.id and g.session_date = ${date}::date
          and g.ended_reason = 'manual' and g.end_odometer is not null
        order by g.ended_at desc
        limit 1
      ) as "endOdometer"
    from users u
    join user_roles ur on ur.user_id = u.id
    join roles r on r.id = ur.role_id
    where r.code = 'SALES_EXECUTIVE' and u.status = 'active'
    order by u.name
  `) as Record<string, unknown>[];

  return rows.map((r) => {
    const startTime = iso(r.startTime);
    return {
      userId: String(r.userId),
      name: String(r.name),
      startTime,
      endTime: iso(r.endTime),
      startOdometer: numOrNull(r.startOdometer),
      endOdometer: numOrNull(r.endOdometer),
      present: startTime != null,
    };
  });
}

export interface MonthlyAttendanceRow {
  date: string; // YYYY-MM-DD
  startTime: string; // ISO of earliest started_at that day
  endTime: string | null; // ISO of the manual "End day" tap that day, else null
  startOdometer: number | null;
  endOdometer: number | null;
}

/** Per-SE month view: one entry per day the SE started, earliest start + (when
 *  they pressed "End day") the end time of each. */
export async function getMonthlyAttendance(
  sql: SqlClient,
  userId: string,
  month: string,
): Promise<MonthlyAttendanceRow[]> {
  const rows = (await sql`
    /* attendance_monthly */
    select
      session_date as "date",
      min(started_at) as "startTime",
      max(ended_at) filter (where ended_reason = 'manual') as "endTime",
      (array_agg(start_odometer order by started_at) filter (where start_odometer is not null))[1] as "startOdometer",
      max(end_odometer) filter (where ended_reason = 'manual') as "endOdometer"
    from gps_tracking_sessions
    where user_id = ${userId}::uuid
      and to_char(session_date, 'YYYY-MM') = ${month}
    group by session_date
    order by session_date
  `) as Record<string, unknown>[];

  return rows.map((r) => ({
    date: dateStr(r.date),
    startTime: iso(r.startTime) ?? "",
    endTime: iso(r.endTime),
    startOdometer: numOrNull(r.startOdometer),
    endOdometer: numOrNull(r.endOdometer),
  }));
}

// ── Manual attendance grid ────────────────────────────────────────────────────
// Effective status per (SE, day): the SUPER_ADMIN's manual override if one
// exists, otherwise derived from tracking — tracked -> present, else (past
// working day) absent, and future days are left blank/locked.

export const ATTENDANCE_STATUSES = ["present", "absent", "half_day", "leave", "week_off", "holiday"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export function assertStatus(status: string): AttendanceStatus {
  if (!(ATTENDANCE_STATUSES as readonly string[]).includes(status)) {
    throw new ApiError("INVALID_FIELD", "Invalid attendance status.", 422);
  }
  return status as AttendanceStatus;
}

/** Guard a status write: the SE must be active, and the date must not be future. */
async function assertEditableTarget(sql: SqlClient, userId: string, date: string): Promise<void> {
  if (date > todayIst()) {
    throw new ApiError("INVALID_FIELD", "Cannot set attendance for a future date.", 422);
  }
  const [se] = (await sql`
    /* attendance_target_is_se */
    select u.id
    from users u
    join user_roles ur on ur.user_id = u.id
    join roles r on r.id = ur.role_id
    where u.id = ${userId}::uuid and r.code = 'SALES_EXECUTIVE' and u.status = 'active'
    limit 1
  `) as Record<string, unknown>[];
  if (!se) throw new ApiError("NOT_FOUND", "Active sales executive not found.", 404);
}

export interface AttendanceCell {
  date: string; // YYYY-MM-DD
  status: AttendanceStatus | null; // null = future/locked (blank)
  manual: boolean; // true when a SUPER_ADMIN set it (vs derived from tracking)
  tracked: boolean; // the SE had a Start-day session that day
  startTime: string | null; // ISO of earliest started_at that day, or null
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

/** Days of a YYYY-MM month as YYYY-MM-DD strings. */
function monthDays(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

/**
 * The editable monthly grid: every active SE with a status for each day of the
 * month. Manual overrides win; otherwise tracked -> present, past untracked ->
 * absent, future -> null (locked). One query for SEs, one for the month's
 * tracked days, one for the month's overrides — assembled in JS.
 */
export async function getAttendanceGrid(
  sql: SqlClient,
  month: string,
): Promise<{ month: string; days: string[]; rows: AttendanceGridRow[] }> {
  const today = todayIst();
  const days = monthDays(month);

  const ses = (await sql`
    /* attendance_grid_ses */
    select u.id as "userId", u.name
    from users u
    join user_roles ur on ur.user_id = u.id
    join roles r on r.id = ur.role_id
    where r.code = 'SALES_EXECUTIVE' and u.status = 'active'
    order by u.name
  `) as Record<string, unknown>[];

  const tracked = (await sql`
    /* attendance_grid_tracked */
    select
      user_id as "userId",
      session_date as "date",
      min(started_at) as "startTime",
      max(ended_at) filter (where ended_reason = 'manual') as "endTime",
      (array_agg(start_odometer order by started_at) filter (where start_odometer is not null))[1] as "startOdometer",
      max(end_odometer) filter (where ended_reason = 'manual') as "endOdometer"
    from gps_tracking_sessions
    where to_char(session_date, 'YYYY-MM') = ${month}
    group by user_id, session_date
  `) as Record<string, unknown>[];

  const overrides = (await sql`
    /* attendance_grid_overrides */
    select user_id as "userId", attendance_date as "date", status, note
    from attendance
    where to_char(attendance_date, 'YYYY-MM') = ${month}
  `) as Record<string, unknown>[];

  const trackedMap = new Map<
    string,
    { startTime: string | null; endTime: string | null; startOdometer: number | null; endOdometer: number | null }
  >();
  for (const t of tracked) {
    trackedMap.set(`${String(t.userId)}|${dateStr(t.date)}`, {
      startTime: iso(t.startTime),
      endTime: iso(t.endTime),
      startOdometer: numOrNull(t.startOdometer),
      endOdometer: numOrNull(t.endOdometer),
    });
  }
  const overrideMap = new Map<string, { status: AttendanceStatus; note: string | null }>();
  for (const o of overrides) {
    overrideMap.set(`${String(o.userId)}|${dateStr(o.date)}`, {
      status: o.status as AttendanceStatus,
      note: (o.note as string | null) ?? null,
    });
  }

  const rows: AttendanceGridRow[] = ses.map((u) => {
    const userId = String(u.userId);
    const cells = days.map((date): AttendanceCell => {
      const key = `${userId}|${date}`;
      const override = overrideMap.get(key);
      const times = trackedMap.get(key);
      const tracked = times != null;
      const startTime = times?.startTime ?? null;
      const endTime = times?.endTime ?? null;
      const startOdometer = times?.startOdometer ?? null;
      const endOdometer = times?.endOdometer ?? null;
      if (override) {
        // Present/absent/half/leave are deliberate calls and win. But an "off"
        // marker (holiday or week_off) yields to actual work — a worked off-day
        // counts as present (so it lands in both present days and working days).
        if ((override.status === "holiday" || override.status === "week_off") && tracked) {
          return { date, status: "present", manual: false, tracked, startTime, endTime, startOdometer, endOdometer, note: null };
        }
        return { date, status: override.status, manual: true, tracked, startTime, endTime, startOdometer, endOdometer, note: override.note };
      }
      if (date > today) return { date, status: null, manual: false, tracked, startTime, endTime, startOdometer, endOdometer, note: null };
      // Derived status (no manual override): worked that day -> present (Sundays
      // included); an untracked Sunday defaults to the weekly off; any other
      // untracked past working day -> absent.
      let status: AttendanceStatus = "absent";
      if (tracked) status = "present";
      else if (isSunday(date)) status = "week_off";
      return { date, status, manual: false, tracked, startTime, endTime, startOdometer, endOdometer, note: null };
    });
    return { userId, name: String(u.name), days: cells };
  });

  return { month, days, rows };
}

/** Upsert a manual status for one (SE, day). SUPER_ADMIN only (route-guarded). */
export async function setAttendance(
  sql: SqlClient,
  input: { userId: string; date: string; status: AttendanceStatus; note: string | null; updatedBy: string },
): Promise<void> {
  await assertEditableTarget(sql, input.userId, input.date);
  await sql`
    /* attendance_upsert */
    insert into attendance (user_id, attendance_date, status, note, updated_by, updated_at)
    values (${input.userId}::uuid, ${input.date}::date, ${input.status}, ${input.note}, ${input.updatedBy}::uuid, now())
    on conflict (user_id, attendance_date) do update set
      status = excluded.status,
      note = excluded.note,
      updated_by = excluded.updated_by,
      updated_at = now()
  `;
}

/** Mark one date a 'holiday' for EVERY active Sales Executive (a company-wide
 *  holiday). Upserts in one set-based statement; returns how many SEs it hit.
 *  Future dates are rejected, matching single-cell writes. SUPER_ADMIN only
 *  (route-guarded). A worked holiday still reads as present (see the grid). */
export async function setHolidayForAllSes(
  sql: SqlClient,
  input: { date: string; note: string | null; updatedBy: string },
): Promise<number> {
  if (input.date > todayIst()) {
    throw new ApiError("INVALID_FIELD", "Cannot set attendance for a future date.", 422);
  }
  const rows = (await sql`
    /* attendance_holiday_all */
    insert into attendance (user_id, attendance_date, status, note, updated_by, updated_at)
    select u.id, ${input.date}::date, 'holiday', ${input.note}, ${input.updatedBy}::uuid, now()
    from users u
    join user_roles ur on ur.user_id = u.id
    join roles r on r.id = ur.role_id
    where r.code = 'SALES_EXECUTIVE' and u.status = 'active'
    on conflict (user_id, attendance_date) do update set
      status = excluded.status,
      note = excluded.note,
      updated_by = excluded.updated_by,
      updated_at = now()
    returning user_id
  `) as unknown[];
  return rows.length;
}

/** Clear a manual override for one (SE, day) — reverts the cell to the derived
 *  (tracking-based) status. SUPER_ADMIN only (route-guarded). */
export async function clearAttendance(sql: SqlClient, userId: string, date: string): Promise<void> {
  await sql`
    /* attendance_clear */
    delete from attendance where user_id = ${userId}::uuid and attendance_date = ${date}::date
  `;
}

// ---- time & attendance summary (per SE + Logistics, for a month) ----

export interface AttendanceSummaryRow {
  userId: string;
  name: string;
  role: string; // SALES_EXECUTIVE | LOGISTICS
  daysPresent: number;
  workingDays: number;
  /** daysPresent / workingDays, as a %. Null when workingDays is 0. */
  attendancePct: number | null;
  /** Avg hours on days that were properly ended (manual End day). Null if none. */
  avgHoursPerDay: number | null;
  /** Avg customer-visit duration in minutes. Null for Logistics / no visits. */
  avgVisitMinutes: number | null;
  /** Avg visits on the days they worked. Null when no present days. */
  avgVisitsPerDay: number | null;
  totalVisits: number;
}

/**
 * Per-person time & attendance for one month — days present + attendance %,
 * average working hours/day (start → manual end), average customer-visit
 * duration, and average visits/day. Covers SALES_EXECUTIVE + LOGISTICS (both
 * start/end their day with GPS); Logistics have no customer visits, so those
 * averages come back null. Working days = days from the 1st up to today (IST)
 * for the current month, else the whole month.
 */
export async function getAttendanceSummary(
  sql: SqlClient,
  from: string,
  to: string,
): Promise<{ workingDays: number; rows: AttendanceSummaryRow[] }> {
  const n = (v: unknown): number => {
    if (typeof v === "number") return v;
    if (typeof v === "string") return Number(v) || 0;
    return 0;
  };
  const s = (v: unknown): string => (typeof v === "string" ? v : "");

  const [boundsRows, roster, sessionRows, visitRows] = await Promise.all([
    sql`/* attendance_summary_bounds */
      select least(${to}::date, (now() at time zone 'Asia/Kolkata')::date) as "capped"`,
    sql`/* attendance_summary_roster */
      select u.id as "userId", u.name as "name", (array_agg(r.code order by r.code))[1] as "role"
      from users u
      join user_roles ur on ur.user_id = u.id
      join roles r on r.id = ur.role_id
      where r.code in ('SALES_EXECUTIVE', 'LOGISTICS') and u.status = 'active'
      group by u.id, u.name
      order by u.name`,
    sql`/* attendance_summary_sessions */
      select d.user_id as "userId", count(*)::int as "daysPresent",
        count(*) filter (where extract(dow from d.session_date) = 0)::int as "workedSundays",
        avg(d.hours) filter (where d.hours is not null) as "avgHours"
      from (
        select g.user_id, g.session_date,
          extract(epoch from (max(g.ended_at) filter (where g.ended_reason = 'manual') - min(g.started_at))) / 3600.0 as hours
        from gps_tracking_sessions g
        where g.session_date between ${from}::date and ${to}::date
        group by g.user_id, g.session_date
      ) d
      group by d.user_id`,
    sql`/* attendance_summary_visits */
      select v.executive_id as "userId", count(*)::int as "totalVisits",
        avg(v.visit_duration_minutes) filter (where v.visit_duration_minutes is not null) as "avgMinutes"
      from visits v
      where v.visit_date between ${from}::date and ${to}::date
      group by v.executive_id`,
  ]);

  const b = (boundsRows as Record<string, unknown>[])[0];
  const d0 = new Date(`${from}T00:00:00Z`);
  const capped = b?.capped instanceof Date ? b.capped : new Date(`${dateStr(b?.capped)}T00:00:00Z`);
  const workingDays = Math.max(0, Math.round((capped.getTime() - d0.getTime()) / 86400000) + 1);

  const sessByUser = new Map<string, { daysPresent: number; workedSundays: number; avgHours: number | null }>();
  for (const r of sessionRows as Record<string, unknown>[]) {
    sessByUser.set(s(r.userId), {
      daysPresent: n(r.daysPresent),
      workedSundays: n(r.workedSundays),
      avgHours: r.avgHours == null ? null : n(r.avgHours),
    });
  }

  // Sundays are the weekly off: they don't count as working days UNLESS the
  // person worked that Sunday. So per person the denominator is the non-Sunday
  // days plus the Sundays they actually worked — which keeps attendance ≤ 100%
  // and never penalises an unworked Sunday.
  let sundaysInRange = 0;
  for (let t = d0.getTime(); t <= capped.getTime(); t += 86_400_000) {
    if (new Date(t).getUTCDay() === 0) sundaysInRange += 1;
  }
  const nonSundayWorkingDays = Math.max(0, workingDays - sundaysInRange);
  const visitByUser = new Map<string, { totalVisits: number; avgMinutes: number | null }>();
  for (const r of visitRows as Record<string, unknown>[]) {
    visitByUser.set(s(r.userId), { totalVisits: n(r.totalVisits), avgMinutes: r.avgMinutes == null ? null : n(r.avgMinutes) });
  }

  const r1 = (x: number) => Math.round(x * 10) / 10;
  const rows: AttendanceSummaryRow[] = (roster as Record<string, unknown>[]).map((u) => {
    const uid = s(u.userId);
    const sess = sessByUser.get(uid);
    const vis = visitByUser.get(uid);
    const daysPresent = sess?.daysPresent ?? 0;
    const workedSundays = sess?.workedSundays ?? 0;
    const effectiveWorkingDays = nonSundayWorkingDays + workedSundays;
    const totalVisits = vis?.totalVisits ?? 0;
    return {
      userId: uid,
      name: s(u.name),
      role: s(u.role),
      daysPresent,
      workingDays: effectiveWorkingDays,
      attendancePct:
        effectiveWorkingDays > 0 ? Math.round((daysPresent / effectiveWorkingDays) * 1000) / 10 : null,
      avgHoursPerDay: sess?.avgHours == null ? null : r1(sess.avgHours),
      avgVisitMinutes: vis?.avgMinutes == null ? null : Math.round(vis.avgMinutes),
      avgVisitsPerDay: daysPresent > 0 ? r1(totalVisits / daysPresent) : null,
      totalVisits,
    };
  });

  return { workingDays, rows };
}
