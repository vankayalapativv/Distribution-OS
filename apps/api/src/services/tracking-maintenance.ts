import type { SqlClient } from "../lib/db";
import { notifyAdminsOfDayEvent } from "./admin-notify";
import { recalculateTrackingSessionDistance } from "./tracking-distance";
import { recalculateTrackingSessionDwell } from "./tracking-dwell";

type Row = Record<string, unknown>;

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
}

function nullStr(v: unknown): string | null {
  const s = str(v);
  return s.length > 0 ? s : null;
}

// Fixed IST clock time so the alert reads the same wherever it renders.
const IST_TIME = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
});

/** "3:31 PM" (IST) for an ISO timestamp, or null when there's no usable value. */
function formatIstTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return IST_TIME.format(d).replace(/[\u202f\u00a0]/g, " ").toUpperCase();
}

/** The more recent of two nullable ISO timestamps — the last time the device
 *  actually communicated (a heartbeat or an accepted location). */
function mostRecent(a: string | null, b: string | null): string | null {
  const ta = a ? Date.parse(a) : Number.NaN;
  const tb = b ? Date.parse(b) : Number.NaN;
  if (Number.isNaN(ta)) return Number.isNaN(tb) ? null : b;
  if (Number.isNaN(tb)) return a;
  return ta >= tb ? a : b;
}

export interface TrackingMaintenanceOptions {
  now?: string;
  staleAfterMinutes?: number;
}

export interface TrackingMaintenanceResult {
  closedSessions: number;
  interruptionAlerts: number;
}

/**
 * Midnight safety cap: force-close any SE tracking session still 'active' once its
 * IST day has fully rolled over. SEs now end their own day with the in-app "End
 * day" button (ended_reason 'manual'); this only catches the ones they forgot to
 * end. The cap is dated to the next IST-day start (end of the session's own day),
 * and tagged 'server_midnight_cap' so attendance (which reports manual ends only)
 * can tell it apart from a real end.
 *
 * Logistics never auto-close — a delivery run ends only when the driver ends it.
 * Runs on EVERY cron tick (not just the office-hours window) because IST midnight
 * falls outside that window.
 */
export async function capExpiredSeSessions(
  sql: SqlClient,
  options: { now?: string } = {},
): Promise<{ closedSessions: number }> {
  const now = options.now ?? new Date().toISOString();
  const closed = await sql`
    /* cap_expired_se_tracking_sessions */
    update gps_tracking_sessions s
    set
      status = 'ended',
      ended_at = coalesce(ended_at, ((s.session_date + 1)::text || ' 00:00')::timestamp at time zone timezone),
      ended_reason = coalesce(ended_reason, 'server_midnight_cap')
    where status = 'active'
      and exists (
        select 1 from user_roles ur
        join roles r on r.id = ur.role_id
        where ur.user_id = s.user_id and r.code = 'SALES_EXECUTIVE'
      )
      and (${now}::timestamptz at time zone timezone)::date > s.session_date
    returning id, user_id as "userId"
  ` as Row[];

  // Recalculate distance/dwell for each capped session, and tell the Super
  // Admins the system auto-closed this forgotten SE day (the notification body
  // says it was ended by the system, not the SE). Only the call that actually
  // closed the session reaches here, so no double-notify. Per-session work runs
  // in parallel; a failed push is swallowed so it can't abort the others.
  await Promise.all(
    closed.map(async (session) => {
      const sessionId = str(session.id);
      await recalculateTrackingSessionDistance(sql, sessionId);
      await recalculateTrackingSessionDwell(sql, sessionId);
      await notifyAdminsOfDayEvent(sql, {
        seUserId: str(session.userId),
        kind: "auto_end",
        at: null,
      }).catch(() => undefined);
    }),
  );

  return { closedSessions: closed.length };
}

export async function runTrackingMaintenance(
  sql: SqlClient,
  options: TrackingMaintenanceOptions = {},
): Promise<TrackingMaintenanceResult> {
  const now = options.now ?? new Date().toISOString();
  const staleAfterMinutes = options.staleAfterMinutes ?? 15;

  // Midnight cap for sessions whose day has passed (also runs standalone every
  // tick from the scheduler so it fires after IST midnight, outside this window).
  const { closedSessions } = await capExpiredSeSessions(sql, { now });

  const staleSessions = await sql`
    /* find_stale_tracking_sessions */
    select
      s.id as "sessionId",
      s.user_id as "userId",
      u.name as "executiveName",
      ell.recorded_at as "lastRecordedAt",
      ell.last_heartbeat_at as "lastHeartbeatAt"
    from gps_tracking_sessions s
    join users u on u.id = s.user_id
    left join executive_latest_locations ell on ell.user_id = s.user_id
    where s.status = 'active'
      and coalesce(ell.last_heartbeat_at, ell.recorded_at, s.started_at, s.created_at)
        < ${now}::timestamptz - (${staleAfterMinutes} * interval '1 minute')
    order by coalesce(ell.last_heartbeat_at, ell.recorded_at, s.started_at, s.created_at)
    limit 200
  ` as Row[];

  // Build per-row values, then upsert them all in ONE set-based statement rather
  // than one INSERT round-trip per stale session (up to 200 → Workers subrequest
  // budget). Constant columns (type/severity/action/status/date) are set in the
  // SELECT; only alert_code / executive_id / message vary per row.
  const codes: string[] = [];
  const userIds: string[] = [];
  const messages: string[] = [];
  for (const session of staleSessions) {
    const sessionId = str(session.sessionId);
    const executiveName = nullStr(session.executiveName) ?? "Sales executive";
    // Show the ACTUAL last-active clock time (IST) — the more recent of the last
    // heartbeat / accepted location — rather than the fixed staleness threshold.
    const lastActive = formatIstTime(mostRecent(nullStr(session.lastHeartbeatAt), nullStr(session.lastRecordedAt)));
    const inactivity = lastActive
      ? `No heartbeat or accepted location has been received since ${lastActive} IST.`
      : `No heartbeat or accepted location has been received for more than ${staleAfterMinutes} minutes.`;
    codes.push(`TRACKING_INTERRUPTED:${sessionId}`);
    userIds.push(str(session.userId));
    messages.push(`Tracking communication interrupted for ${executiveName}. ${inactivity}`);
  }

  let interruptionAlerts = 0;
  if (codes.length > 0) {
    const inserted = (await sql`
      /* upsert_tracking_interruption_alerts */
      insert into alerts (
        alert_code, alert_date, alert_type, severity, executive_id,
        alert_message, recommended_action, status
      )
      select
        t.code,
        (${now}::timestamptz at time zone 'Asia/Kolkata')::date,
        'TRACKING_COMMUNICATION_INTERRUPTED',
        'high',
        t.user_id,
        t.message,
        'Contact the executive and check phone power, network, GPS, permissions, and battery restrictions.',
        'open'
      from unnest(${codes}::text[], ${userIds}::uuid[], ${messages}::text[]) as t(code, user_id, message)
      on conflict (alert_code) do update
      set
        updated_at = now(),
        alert_message = excluded.alert_message,
        recommended_action = excluded.recommended_action
      returning id
    `) as Row[];
    interruptionAlerts = inserted.length;
  }

  return {
    closedSessions,
    interruptionAlerts,
  };
}
