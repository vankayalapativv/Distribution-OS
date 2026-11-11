import type { SqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";
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

function nullNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Plausible band for a day's travel (end − start odometer), in km. Below the
 *  minimum is the "0 → 1" gaming; above the maximum is a typo like "1 → 1300".
 *  The server is the source of truth; the device odometer prompt mirrors these. */
const MIN_DAY_DISTANCE_KM = 10;
const MAX_DAY_DISTANCE_KM = 200;

/** True for the "already an active session for this user+device" unique race. */
function isOneActiveSessionConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const dbError = error as { code?: unknown; constraint?: unknown; message?: unknown };
  return String(dbError.code) === "23505" && (
    String(dbError.constraint) === "gps_tracking_sessions_one_active_per_user_device" ||
    String(dbError.message).includes("gps_tracking_sessions_one_active_per_user_device")
  );
}

function mapSession(row: Row) {
  return {
    trackingSessionId: str(row.id),
    clientSessionId: nullStr(row.clientSessionId),
    userId: str(row.userId),
    deviceId: nullStr(row.deviceId),
    sessionDate: str(row.sessionDate).slice(0, 10),
    startedAt: nullStr(row.startedAt),
    endedAt: nullStr(row.endedAt),
    status: str(row.status),
    // Whole-km odometer readings (SE day). Present on queries that select them;
    // undefined → null (older callers that don't).
    startOdometer: nullNum(row.startOdometer),
    endOdometer: nullNum(row.endOdometer),
  };
}

function localDateTimeParts(iso: string, timezone: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError("INVALID_FIELD", "recordedAt must be a valid timestamp.", 422);
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const value = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    hour: Number(value("hour")),
    minute: Number(value("minute")),
    second: Number(value("second")),
  };
}

// Sales Executives are tracked until the END of their IST day (cutoff hour 24):
// every point whose IST date is the session's start day is accepted, and only
// points that spill into the NEXT IST date are dropped. SEs end their day with
// the in-app "End day" button; a forgotten day is force-closed by the midnight
// cap cron. Logistics have NO cutoff (`null`) — a run ends only when the driver
// ends it, even across midnight.
export function trackingCutoffHour(role: string | null | undefined): number | null {
  return role === "SALES_EXECUTIVE" ? 24 : null;
}

export function isAfterAllowedEndTime(input: {
  recordedAt: string;
  sessionDate: string;
  timezone: string;
  cutoffHour: number | null;
}) {
  // No cutoff (Logistics): never past the allowed end — accept points at any
  // hour and on any day, including after midnight, until the run is ended.
  if (input.cutoffHour === null) return false;
  const local = localDateTimeParts(input.recordedAt, input.timezone);
  // Drop only points that spill past the session's start day. With the SE cutoff
  // at hour 24, same-day points are always kept (hour is 0-23, never >= 24).
  if (local.date > input.sessionDate) return true;
  if (local.date < input.sessionDate) return false;
  return local.hour >= input.cutoffHour;
}

export async function getActiveTrackingSession(sql: SqlClient, userId: string) {
  const [session] = await sql`
    /* get_active_tracking_session */
    select
      id,
      client_session_id as "clientSessionId",
      user_id as "userId",
      device_id as "deviceId",
      session_date as "sessionDate",
      started_at as "startedAt",
      ended_at as "endedAt",
      status,
      start_odometer as "startOdometer",
      end_odometer as "endOdometer"
    from gps_tracking_sessions
    where user_id = ${userId}::uuid
      and status = 'active'
    order by started_at desc nulls last, created_at desc
    limit 1
  ` as Row[];

  return session ? mapSession(session) : null;
}

/**
 * The tracking session that owns `clientSessionId`, as an idempotent "existing"
 * result. The mobile app sends a DETERMINISTIC client_session_id per Start Day,
 * so a double-tap, an offline retry, or a network re-send is the same key —
 * return its session (even if since ended) instead of inserting a duplicate.
 */
async function sessionByClientSessionId(sql: SqlClient, clientSessionId: string) {
  const [row] = await sql`
    /* get_tracking_session_by_client_session_id */
    select
      id,
      client_session_id as "clientSessionId",
      user_id as "userId",
      device_id as "deviceId",
      session_date as "sessionDate",
      started_at as "startedAt",
      ended_at as "endedAt",
      status,
      start_odometer as "startOdometer",
      end_odometer as "endOdometer"
    from gps_tracking_sessions
    where client_session_id = ${clientSessionId}::uuid
    limit 1
  ` as Row[];
  return row ? mapSession(row) : null;
}

/** Sets start_odometer on a reused session when it has none yet, so a Start-day
 *  reading is never silently dropped when the session is reused rather than
 *  created (e.g. a re-tap of an already-running day). */
async function backfillStartOdometer(
  sql: SqlClient,
  trackingSessionId: string,
  startOdometer: number | null | undefined,
) {
  if (startOdometer == null) return;
  await sql`
    /* backfill_start_odometer */
    update gps_tracking_sessions
    set start_odometer = ${startOdometer}
    where id = ${trackingSessionId}::uuid and start_odometer is null
  `;
}

export async function startTrackingSession(
  sql: SqlClient,
  input: {
    userId: string;
    clientSessionId: string;
    deviceId: string | null;
    role?: string | null;
    /** Whole-km vehicle reading from the Start-day dialog (SE only). */
    startOdometer?: number | null;
  },
) {
  // Already tracking → reuse the live session (the common "Start Day" re-tap).
  // Back-fill a just-entered Start-day odometer so a re-tap that supplies the
  // reading isn't dropped on the already-open session.
  const existing = await getActiveTrackingSession(sql, input.userId);
  if (existing) {
    await backfillStartOdometer(sql, existing.trackingSessionId, input.startOdometer);
    return { session: existing, existing: true };
  }

  // A retry/replay of the SAME start returns that session idempotently — even if
  // it has since ended — so a replay never re-inserts a duplicate
  // client_session_id (this was a recurring 500 on
  // gps_tracking_sessions_client_session_id_key). Mirrors the visits/orders/
  // collections clientUuid idempotency.
  const replay = await sessionByClientSessionId(sql, input.clientSessionId);
  if (replay) {
    await backfillStartOdometer(sql, replay.trackingSessionId, input.startOdometer);
    return { session: replay, existing: true };
  }

  // An SE who has already ENDED their day (the in-app "End day" button, tagged
  // ended_reason 'manual') cannot re-start until tomorrow. The midnight cap
  // ('server_midnight_cap') is NOT a manual end, so a forgotten day that the cron
  // closed does not block a fresh start. Logistics have no such block.
  if (input.role === "SALES_EXECUTIVE") {
    const [endedToday] = await sql`
      /* se_manual_ended_today */
      select 1 as "found"
      from gps_tracking_sessions
      where user_id = ${input.userId}::uuid
        and session_date = (now() at time zone 'Asia/Kolkata')::date
        and ended_reason = 'manual'
      limit 1
    ` as Row[];
    if (endedToday) {
      throw new ApiError(
        "DAY_ENDED",
        "You've ended your day. Start again tomorrow.",
        422,
      );
    }
  }

  let session: Row | undefined;
  try {
    [session] = await sql`
      /* create_tracking_session */
      insert into gps_tracking_sessions (
        user_id,
        client_session_id,
        device_id,
        session_date,
        started_at,
        status,
        start_odometer
      )
      values (
        ${input.userId}::uuid,
        ${input.clientSessionId}::uuid,
        ${input.deviceId},
        (now() at time zone 'Asia/Kolkata')::date,
        now(),
        'active',
        ${input.startOdometer ?? null}
      )
      on conflict (client_session_id) where client_session_id is not null do nothing
      returning
        id,
        client_session_id as "clientSessionId",
        user_id as "userId",
        device_id as "deviceId",
        session_date as "sessionDate",
        started_at as "startedAt",
        ended_at as "endedAt",
        status,
        start_odometer as "startOdometer",
        end_odometer as "endOdometer"
    ` as Row[];
  } catch (error) {
    // A concurrent Start Day for the SAME user+device (a DIFFERENT
    // clientSessionId) lost the one-active-session race — return the winner's
    // active session rather than surfacing the 23505 as a 500.
    if (!isOneActiveSessionConflict(error)) throw error;
    const winner = await getActiveTrackingSession(sql, input.userId);
    if (winner) return { session: winner, existing: true };
    throw error;
  }

  // The insert did nothing → a concurrent duplicate of this SAME start (same
  // clientSessionId) won the race. Return the winner's row as idempotent
  // success instead of a 500.
  if (!session) {
    const winner =
      (await sessionByClientSessionId(sql, input.clientSessionId)) ??
      (await getActiveTrackingSession(sql, input.userId));
    if (winner) return { session: winner, existing: true };
    throw new ApiError("INTERNAL_ERROR", "Could not start tracking session.", 500);
  }

  return { session: mapSession(session), existing: false };
}

export async function endTrackingSession(
  sql: SqlClient,
  input: {
    userId: string;
    trackingSessionId: string;
    /** Whole-km vehicle reading from the End-day dialog (SE only). */
    endOdometer?: number | null;
  },
) {
  // The end reading must be higher than the day's start reading, and the day's
  // travel (end − start) must sit in a plausible band. Authoritative guard (the
  // device validates too, but the server is the source of truth and also covers
  // a start reading the device couldn't see). Only enforced when both readings
  // are known.
  if (input.endOdometer != null) {
    const [existing] = await sql`
      /* end_tracking_session_start_odo */
      select start_odometer as "startOdometer"
      from gps_tracking_sessions
      where id = ${input.trackingSessionId}::uuid and user_id = ${input.userId}::uuid
    ` as Row[];
    const startOdo = nullNum(existing?.startOdometer);
    if (startOdo != null) {
      if (input.endOdometer <= startOdo) {
        throw new ApiError(
          "END_ODOMETER_TOO_LOW",
          `The end reading must be higher than the start reading (${startOdo} km).`,
          422,
        );
      }
      const distanceKm = input.endOdometer - startOdo;
      if (distanceKm < MIN_DAY_DISTANCE_KM) {
        throw new ApiError(
          "ODOMETER_DISTANCE_TOO_LOW",
          `A day's travel must be at least ${MIN_DAY_DISTANCE_KM} km — enter your real current odometer reading.`,
          422,
        );
      }
      if (distanceKm > MAX_DAY_DISTANCE_KM) {
        throw new ApiError(
          "ODOMETER_DISTANCE_TOO_HIGH",
          `A day's travel can't exceed ${MAX_DAY_DISTANCE_KM} km (${distanceKm} km entered) — please check the reading.`,
          422,
        );
      }
    }
  }

  // A client end is always a MANUAL end (the SE's "End day" button, or a
  // Logistics "End run"). Attendance reports manual ends only, so stamping this
  // is what lets an SE's day show an "Ended" time. The only other reason,
  // 'server_midnight_cap', is written by the cron — never here.
  const [updated] = await sql`
    /* end_tracking_session */
    update gps_tracking_sessions
    set status = 'ended',
        ended_at = coalesce(ended_at, now()),
        ended_reason = coalesce(ended_reason, 'manual'),
        end_odometer = coalesce(end_odometer, ${input.endOdometer ?? null})
    where id = ${input.trackingSessionId}::uuid
      and user_id = ${input.userId}::uuid
      and status = 'active'
    returning
      id,
      client_session_id as "clientSessionId",
      user_id as "userId",
      device_id as "deviceId",
      session_date as "sessionDate",
      started_at as "startedAt",
      ended_at as "endedAt",
      status,
      start_odometer as "startOdometer",
      end_odometer as "endOdometer"
  ` as Row[];

  if (updated) {
    await recalculateTrackingSessionDistance(sql, input.trackingSessionId);
    await recalculateTrackingSessionDwell(sql, input.trackingSessionId);
    // justEnded: THIS call performed the end (status active → ended), so a
    // caller can fire a one-time "day ended" side effect without double-firing
    // on a replay / already-ended session (the fallback below).
    return { session: mapSession(updated), justEnded: true };
  }

  const [session] = await sql`
    /* get_tracking_session_by_id */
    select
      id,
      client_session_id as "clientSessionId",
      user_id as "userId",
      device_id as "deviceId",
      session_date as "sessionDate",
      started_at as "startedAt",
      ended_at as "endedAt",
      status,
      start_odometer as "startOdometer",
      end_odometer as "endOdometer"
    from gps_tracking_sessions
    where id = ${input.trackingSessionId}::uuid
      and user_id = ${input.userId}::uuid
    limit 1
  ` as Row[];

  if (!session) throw new ApiError("NOT_FOUND", "Tracking session not found.", 404);
  return { session: mapSession(session), justEnded: false };
}

export interface TrackingPointInput {
  locationPointId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  batteryPercentage: number | null;
  recordedAt: string;
}

export interface TrackingHeartbeatInput {
  deviceId: string | null;
  capturedAt: string;
  batteryPercentage: number | null;
  isCharging: boolean | null;
  isLowPowerModeEnabled: boolean | null;
  isLocationEnabled: boolean | null;
  foregroundPermission: string | null;
  backgroundPermission: string | null;
  notificationPermission: string | null;
  batteryOptimizationStatus: string | null;
  networkType: string | null;
  isConnected: boolean | null;
  queuedPointCount: number;
  lastLocationAt: string | null;
  lastSuccessfulSyncAt: string | null;
  appVersion: string | null;
  androidVersion: string | null;
  manufacturer: string | null;
  model: string | null;
}

export async function insertTrackingPoints(
  sql: SqlClient,
  input: { userId: string; trackingSessionId: string; points: TrackingPointInput[]; role?: string | null },
) {
  const [session] = await sql`
    /* get_tracking_session_for_points */
    select
      id,
      user_id as "userId",
      session_date as "sessionDate",
      timezone,
      status
    from gps_tracking_sessions
    where id = ${input.trackingSessionId}::uuid
      and user_id = ${input.userId}::uuid
    limit 1
  ` as Row[];

  if (!session) throw new ApiError("NOT_FOUND", "Tracking session not found.", 404);
  const sessionDate = str(session.sessionDate).slice(0, 10);
  const timezone = nullStr(session.timezone) ?? "Asia/Kolkata";

  // Split into validation-rejected vs. insert candidates first, so all DB writes
  // for one batch travel in a SINGLE round-trip instead of one HTTP request per
  // point (the previous N+1 on the hottest write path — see architecture audit
  // G-0401). `on conflict do nothing` with no target skips BOTH the
  // location_point_id idempotency dup and the (user_id, recorded_at) dedup
  // constraint, so a returned row means the point was newly accepted.
  const rejected = new Map<string, "INVALID_COORDINATES" | "AFTER_ALLOWED_END_TIME">();
  const candidates: TrackingPointInput[] = [];
  for (const point of input.points) {
    if (point.latitude < -90 || point.latitude > 90 || point.longitude < -180 || point.longitude > 180) {
      rejected.set(point.locationPointId, "INVALID_COORDINATES");
    } else if (isAfterAllowedEndTime({ recordedAt: point.recordedAt, sessionDate, timezone, cutoffHour: trackingCutoffHour(input.role) })) {
      rejected.set(point.locationPointId, "AFTER_ALLOWED_END_TIME");
    } else {
      candidates.push(point);
    }
  }

  const acceptedIds = new Set<string>();
  if (candidates.length > 0) {
    const inserts = candidates.map(
      (point) => sql`
        /* insert_tracking_point */
        insert into gps_points (
          session_id, user_id, location_point_id, latitude, longitude,
          accuracy_meters, battery_percentage, recorded_at
        )
        values (
          ${input.trackingSessionId}::uuid,
          ${input.userId}::uuid,
          ${point.locationPointId}::uuid,
          ${point.latitude},
          ${point.longitude},
          ${point.accuracy},
          ${point.batteryPercentage == null ? null : Math.round(point.batteryPercentage)},
          ${point.recordedAt}::timestamptz
        )
        on conflict do nothing
        returning location_point_id as "locationPointId"
      `,
    );
    // One HTTP round-trip for the whole batch (Neon transaction batching).
    const inserted = (await sql.transaction(inserts)) as Row[][];
    inserted.forEach((rows, i) => {
      if (rows.length > 0) acceptedIds.add(candidates[i].locationPointId);
    });
  }

  const results = input.points.map((point) => {
    const reason = rejected.get(point.locationPointId);
    if (reason) return { locationPointId: point.locationPointId, status: "rejected" as const, reason };
    return {
      locationPointId: point.locationPointId,
      status: acceptedIds.has(point.locationPointId) ? ("accepted" as const) : ("duplicate" as const),
    };
  });

  // Update the latest-known-location ONCE, with the newest accepted point. The
  // per-point upsert's recorded_at guard meant only the newest ever won anyway,
  // so a single upsert with the max-recorded_at point is equivalent.
  const acceptedPoints = candidates.filter((p) => acceptedIds.has(p.locationPointId));
  if (acceptedPoints.length > 0) {
    let latest = acceptedPoints[0];
    for (const p of acceptedPoints) {
      if (p.recordedAt >= latest.recordedAt) latest = p;
    }
    await sql`
      /* upsert_latest_location */
      insert into executive_latest_locations (
        user_id,
        tracking_session_id,
        latitude,
        longitude,
        accuracy,
        recorded_at,
        received_at,
        battery_percentage,
        tracking_status,
        updated_at
      )
      values (
        ${input.userId}::uuid,
        ${input.trackingSessionId}::uuid,
        ${latest.latitude},
        ${latest.longitude},
        ${latest.accuracy},
        ${latest.recordedAt}::timestamptz,
        now(),
        ${latest.batteryPercentage == null ? null : Math.round(latest.batteryPercentage)},
        'active',
        now()
      )
      on conflict (user_id) do update
      set
        tracking_session_id = excluded.tracking_session_id,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        accuracy = excluded.accuracy,
        recorded_at = excluded.recorded_at,
        received_at = excluded.received_at,
        battery_percentage = coalesce(excluded.battery_percentage, executive_latest_locations.battery_percentage),
        tracking_status = excluded.tracking_status,
        updated_at = excluded.updated_at
      where executive_latest_locations.recorded_at is null
        or excluded.recorded_at >= executive_latest_locations.recorded_at
    `;

    await recalculateTrackingSessionDistance(sql, input.trackingSessionId);
    await recalculateTrackingSessionDwell(sql, input.trackingSessionId);
  }

  return { results };
}

export async function recordTrackingHeartbeat(
  sql: SqlClient,
  input: { userId: string; trackingSessionId: string; heartbeat: TrackingHeartbeatInput },
) {
  const [session] = await sql`
    /* get_tracking_session_for_heartbeat */
    select id, user_id as "userId"
    from gps_tracking_sessions
    where id = ${input.trackingSessionId}::uuid
      and user_id = ${input.userId}::uuid
    limit 1
  ` as Row[];

  if (!session) throw new ApiError("NOT_FOUND", "Tracking session not found.", 404);

  const heartbeat = input.heartbeat;
  const [inserted] = await sql`
    /* insert_tracking_heartbeat */
    insert into tracking_device_heartbeats (
      tracking_session_id,
      user_id,
      device_id,
      captured_at,
      battery_percentage,
      is_charging,
      is_low_power_mode_enabled,
      is_location_enabled,
      foreground_permission,
      background_permission,
      notification_permission,
      battery_optimization_status,
      network_type,
      is_connected,
      queued_point_count,
      last_location_at,
      last_successful_sync_at,
      app_version,
      android_version,
      manufacturer,
      model
    )
    values (
      ${input.trackingSessionId}::uuid,
      ${input.userId}::uuid,
      ${heartbeat.deviceId},
      ${heartbeat.capturedAt}::timestamptz,
      ${heartbeat.batteryPercentage == null ? null : Math.round(heartbeat.batteryPercentage)},
      ${heartbeat.isCharging},
      ${heartbeat.isLowPowerModeEnabled},
      ${heartbeat.isLocationEnabled},
      ${heartbeat.foregroundPermission},
      ${heartbeat.backgroundPermission},
      ${heartbeat.notificationPermission},
      ${heartbeat.batteryOptimizationStatus},
      ${heartbeat.networkType},
      ${heartbeat.isConnected},
      ${heartbeat.queuedPointCount},
      ${heartbeat.lastLocationAt}::timestamptz,
      ${heartbeat.lastSuccessfulSyncAt}::timestamptz,
      ${heartbeat.appVersion},
      ${heartbeat.androidVersion},
      ${heartbeat.manufacturer},
      ${heartbeat.model}
    )
    returning id as "heartbeatId"
  ` as Row[];

  await sql`
    /* upsert_latest_health */
    insert into executive_latest_locations (
      user_id,
      tracking_session_id,
      battery_percentage,
      last_heartbeat_at,
      is_location_enabled,
      foreground_permission,
      background_permission,
      notification_permission,
      battery_optimization_status,
      network_type,
      is_connected,
      queued_point_count,
      last_successful_sync_at,
      tracking_status,
      updated_at
    )
    values (
      ${input.userId}::uuid,
      ${input.trackingSessionId}::uuid,
      ${heartbeat.batteryPercentage == null ? null : Math.round(heartbeat.batteryPercentage)},
      ${heartbeat.capturedAt}::timestamptz,
      ${heartbeat.isLocationEnabled},
      ${heartbeat.foregroundPermission},
      ${heartbeat.backgroundPermission},
      ${heartbeat.notificationPermission},
      ${heartbeat.batteryOptimizationStatus},
      ${heartbeat.networkType},
      ${heartbeat.isConnected},
      ${heartbeat.queuedPointCount},
      ${heartbeat.lastSuccessfulSyncAt}::timestamptz,
      'active',
      now()
    )
    on conflict (user_id) do update
    set
      tracking_session_id = excluded.tracking_session_id,
      battery_percentage = coalesce(excluded.battery_percentage, executive_latest_locations.battery_percentage),
      last_heartbeat_at = excluded.last_heartbeat_at,
      is_location_enabled = excluded.is_location_enabled,
      foreground_permission = excluded.foreground_permission,
      background_permission = excluded.background_permission,
      notification_permission = excluded.notification_permission,
      battery_optimization_status = excluded.battery_optimization_status,
      network_type = excluded.network_type,
      is_connected = excluded.is_connected,
      queued_point_count = excluded.queued_point_count,
      last_successful_sync_at = excluded.last_successful_sync_at,
      tracking_status = excluded.tracking_status,
      updated_at = excluded.updated_at
  `;

  return { heartbeatId: str(inserted?.heartbeatId) };
}

/**
 * Stamp the executive's last sign-out on their latest-location row (best-effort
 * beacon from the mobile logout flow). The tracking classifier reads this to show
 * a calm "Signed out" for an otherwise-stale row instead of the red
 * "Tracking interrupted". We only UPDATE an existing row: an executive with no
 * latest-location row hasn't tracked, so they never appear on the live map and
 * need no marker. Logout must NOT end the shared server session (that stays
 * deliberately open — accounts are shared and days end via the cron / "End run"),
 * so this touches only the display signal.
 */
export async function recordExecutiveSignedOut(sql: SqlClient, input: { userId: string }) {
  await sql`
    /* stamp_executive_signed_out */
    update executive_latest_locations
    set last_signed_out_at = now(), updated_at = now()
    where user_id = ${input.userId}::uuid
  `;
  return { ok: true as const };
}
