import type { SqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";
import { materializeTodayPlan } from "./beat-materialize";
import { createCheckoutFollowup } from "./followups";
import { trackingCutoffHour } from "./tracking-sessions";

type Row = Record<string, unknown>;

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
}

function generateVisitCode(): string {
  // IST business day (not UTC) so the code's date matches the visit_date row.
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .replace(/-/g, "");
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 5).toUpperCase();
  return `VIS-${date}-${rand}`;
}

/**
 * The visit that owns `clientUuid`, as an idempotent "existing" result — used
 * when an INSERT lost the race to a concurrent duplicate of the SAME check-in
 * (the client sends a DETERMINISTIC clientUuid per SE+customer+day, so a
 * double-tap or retry is the same key). Returns null only if the row truly
 * isn't there yet.
 */
async function existingVisitByClientUuid(sql: SqlClient, clientUuid: string) {
  const [existing] = (await sql`
    /* get_visit_by_client_uuid */
    select id, visit_code as "visitCode", check_in_time as "checkInTime",
           (check_out_time is not null) as "checkedOut"
    from visits
    where client_uuid = ${clientUuid}::uuid
  `) as Row[];
  if (!existing) return null;
  return {
    visitId: str(existing.id),
    visitCode: str(existing.visitCode),
    checkInTime: str(existing.checkInTime),
    checkedOut: existing.checkedOut === true,
    existing: true as const,
  };
}

export interface CheckInContext {
  userId: string;
  /** Planned visit: the beat stop being visited. */
  beatPlanStopId?: string | null;
  /** Unplanned visit (VISIT-RULES.md): direct customer check-in, no stop. */
  customerId?: string | null;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  clientUuid: string | null;
}

export interface CheckOutContext {
  userId: string;
  visitId: string;
  /** Manual check-out always carries a GPS fix (required for the geofence + the
   *  time-spent duration). */
  latitude: number;
  longitude: number;
  accuracy: number | null;
  /** The mandatory no-outcome reason, supplied on the retry after a 422. */
  reason: string | null;
  /** Optional ISO follow-up date+time the SE picked for a no-outcome visit. */
  followUpAt?: string | null;
}

export interface GpsPing {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  batteryPercentage: number | null;
  recordedAt: string;
}

export interface BatchGpsContext {
  userId: string;
  points: GpsPing[];
  role?: string | null;
}

/**
 * SE tracking days end at 8 PM IST (Logistics at 9 PM) — points recorded at or
 * past the cutoff on their IST day are dropped, so an offline backlog synced in
 * the evening still lands but nothing is tracked after hours.
 */
function istHourOf(iso: string): { date: string; hour: number } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const v = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${v("year")}-${v("month")}-${v("day")}`, hour: Number(v("hour")) };
}

/** The check-in/out geofence radius (metres) — mirrors the mobile `CHECKIN_RADIUS_M`. */
const VISIT_FENCE_M = 100;

/** Haversine distance in metres between two lat/long points. */
function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Same fence as the mobile check-in: distance minus GPS accuracy must be ≤100 m
 *  (a null accuracy counts as an exact fix). */
function withinFence(custLat: number, custLng: number, lat: number, lng: number, accuracy: number | null): boolean {
  const effective = Math.round(distanceMeters(custLat, custLng, lat, lng)) - Math.max(0, accuracy ?? 0);
  return effective <= VISIT_FENCE_M;
}

/** An INSERT that returned no row lost the race to a concurrent duplicate of the
 *  SAME check-in (deterministic clientUuid) — return the winner's row as
 *  idempotent success, or fail if the row truly isn't there. */
async function visitRaceWinnerOrThrow(sql: SqlClient, clientUuid: string) {
  const existing = await existingVisitByClientUuid(sql, clientUuid);
  if (existing) return existing;
  throw new ApiError("INTERNAL_ERROR", "Could not record the visit.", 500);
}

/**
 * Direct customer check-in — the ONLY path the app uses (there is no separate
 * beat check-in UI). If the customer is a stop on THIS SE's beat plan for today,
 * the visit is recorded as PLANNED (linked to the plan) and the stop is marked
 * 'checked_in' (checkout later completes it); otherwise it's an unplanned visit.
 */
async function checkInDirectCustomer(sql: SqlClient, context: CheckInContext) {
  const [customer] = await sql`
    /* get_customer_exists */
    select id from customers where id = ${context.customerId}::uuid
  ` as Row[];
  if (!customer) throw new ApiError("NOT_FOUND", "Customer not found.", 404);

  // One OPEN visit per SE per day: block a check-in at a DIFFERENT customer
  // while a visit is still open (not yet checked out).
  const [open] = (await sql`
    /* checkin_open_visit_guard */
    select v.customer_id as "customerId", c.legal_name as "name"
    from visits v
    join customers c on c.id = v.customer_id
    where v.executive_id = ${context.userId}::uuid
      and v.visit_date = (now() at time zone 'Asia/Kolkata')::date
      and v.check_out_time is null
    limit 1
  `) as Row[];
  if (open && str(open.customerId) !== context.customerId) {
    // Carry the open visit's customer so the app can offer a jump straight to it.
    throw new ApiError(
      "OPEN_VISIT",
      `Finish your visit at ${str(open.name) || "the other shop"} first.`,
      409,
      { customerId: str(open.customerId), customerName: str(open.name) },
    );
  }

  // Materialize today's beat FIRST, so a customer added to this SE's beat
  // earlier today (e.g. just created in the field) already has a stop. Without
  // this the check-in would race the beat materialization: recorded as
  // 'unplanned', and then the 8 PM cron would add a duplicate 'missed' entry
  // for the very same visit. Idempotent (same op as GET /beats/today).
  const [today] = (await sql`
    /* checkin_ist_today */
    select
      extract(isodow from (now() at time zone 'Asia/Kolkata'))::int as "weekday",
      (now() at time zone 'Asia/Kolkata')::date as "istDate"
  `) as Row[];
  const weekday = Number(today?.weekday ?? 0);
  if (weekday >= 1 && weekday <= 6) {
    await materializeTodayPlan(sql, context.userId, str(today?.istDate), weekday);
  }

  // Deterministic: a customer appears at most once on today's plan (unique
  // (beat_plan_id, customer_id)). Present ⇒ this is a PLANNED beat visit.
  const [stop] = await sql`
    /* find_today_beat_stop_for_customer */
    select bps.id, bps.beat_plan_id as "beatPlanId"
    from beat_plan_stops bps
    join beat_plans bp on bp.id = bps.beat_plan_id
    where bps.customer_id = ${context.customerId}::uuid
      and bp.executive_id = ${context.userId}::uuid
      and bp.plan_date = (now() at time zone 'Asia/Kolkata')::date
    limit 1
  ` as Row[];
  const beatPlanId = stop ? str(stop.beatPlanId) : null;

  const visitCode = generateVisitCode();
  const [visit] = await sql`
    /* create_visit_from_customer */
    insert into visits (
      visit_code, visit_date, executive_id, customer_id, beat_plan_id,
      planned_or_unplanned, check_in_time, check_in_latitude, check_in_longitude, client_uuid
    )
    values (
      ${visitCode}, (now() at time zone 'Asia/Kolkata')::date, ${context.userId}::uuid, ${context.customerId}::uuid, ${beatPlanId}::uuid,
      ${stop ? "planned" : "unplanned"}, now(), ${context.latitude}, ${context.longitude}, ${context.clientUuid}::uuid
    )
    on conflict (client_uuid) where client_uuid is not null do nothing
    returning id, visit_code as "visitCode", check_in_time as "checkInTime"
  ` as Row[];

  // Lost the insert race to a concurrent duplicate of this SAME check-in
  // (deterministic clientUuid) — return the winner's row as idempotent success
  // instead of a 500. The winner already recorded the beat stop check-in here.
  if (!visit) return visitRaceWinnerOrThrow(sql, context.clientUuid as string);

  // Check-in marks the beat stop 'checked_in' (the SE has arrived). It only
  // becomes 'completed' (done) when the SE checks OUT (update_stop_on_checkout),
  // so the stop stays "Checked in" in the beat plan until checkout (2026-10-05).
  if (stop) {
    await sql`
      /* checkin_beat_stop */
      update beat_plan_stops
      set stop_status = 'checked_in', visit_id = ${str(visit.id)}::uuid
      where id = ${str(stop.id)}::uuid
    `;
  }

  return {
    visitId: str(visit.id),
    visitCode: str(visit.visitCode),
    checkInTime: str(visit.checkInTime),
    existing: false,
  };
}

/** Beat-stop check-in: the planned path addressed directly by `beatPlanStopId`. */
async function checkInBeatStop(sql: SqlClient, context: CheckInContext) {
  const [stop] = await sql`
    /* get_beat_plan_stop_for_checkin */
    select
      bps.id,
      bps.stop_status as "stopStatus",
      bps.customer_id as "customerId",
      bps.beat_plan_id as "beatPlanId",
      bp.executive_id as "executiveId"
    from beat_plan_stops bps
    join beat_plans bp on bp.id = bps.beat_plan_id
    where bps.id = ${context.beatPlanStopId}::uuid
  ` as Row[];

  if (!stop) throw new ApiError("NOT_FOUND", "Beat plan stop not found.", 404);
  if (str(stop.executiveId) !== context.userId) {
    throw new ApiError("FORBIDDEN", "This stop is not assigned to you.", 403);
  }
  if (str(stop.stopStatus) === "checked_in") {
    throw new ApiError("CONFLICT", "Already checked in at this stop.", 409);
  }
  if (str(stop.stopStatus) === "completed") {
    throw new ApiError("CONFLICT", "This stop is already completed.", 409);
  }

  const visitCode = generateVisitCode();

  const [visit] = await sql`
    /* create_visit */
    insert into visits (
      visit_code,
      visit_date,
      executive_id,
      customer_id,
      beat_plan_id,
      planned_or_unplanned,
      check_in_time,
      check_in_latitude,
      check_in_longitude,
      client_uuid
    )
    values (
      ${visitCode},
      (now() at time zone 'Asia/Kolkata')::date,
      ${context.userId}::uuid,
      ${str(stop.customerId)}::uuid,
      ${str(stop.beatPlanId)}::uuid,
      'planned',
      now(),
      ${context.latitude},
      ${context.longitude},
      ${context.clientUuid}::uuid
    )
    on conflict (client_uuid) where client_uuid is not null do nothing
    returning
      id,
      visit_code as "visitCode",
      check_in_time as "checkInTime"
  ` as Row[];

  // Concurrent duplicate of the SAME check-in won the race — return its row as
  // idempotent success (the winner already updated the stop below).
  if (!visit) return visitRaceWinnerOrThrow(sql, context.clientUuid as string);

  await sql`
    /* update_stop_on_checkin */
    update beat_plan_stops
    set stop_status = 'checked_in',
        visit_id    = ${str(visit.id)}::uuid
    where id = ${context.beatPlanStopId}::uuid
  `;

  return {
    visitId: str(visit.id),
    visitCode: str(visit.visitCode),
    checkInTime: str(visit.checkInTime),
    existing: false,
  };
}

export async function checkIn(sql: SqlClient, context: CheckInContext) {
  // Fast path: a non-concurrent re-check-in (same deterministic clientUuid)
  // returns the existing visit without attempting an insert. The INSERTs in the
  // branch helpers additionally guard the CONCURRENT case (on conflict do
  // nothing), which this SELECT-then-insert can't cover on its own.
  if (context.clientUuid) {
    const existing = await existingVisitByClientUuid(sql, context.clientUuid);
    if (existing) {
      // No re-check-in at the same customer the same day once checked out.
      if (existing.checkedOut) {
        throw new ApiError("ALREADY_VISITED", "You've already completed a visit here today.", 409);
      }
      return existing;
    }
  }

  // Direct customer check-in (the ONLY path the app uses) vs. the legacy
  // beat-stop path addressed by beatPlanStopId.
  if (!context.beatPlanStopId) return checkInDirectCustomer(sql, context);
  return checkInBeatStop(sql, context);
}

/**
 * Manual check-out of an open visit by the SE. Requires a GPS fix inside the
 * same 100 m geofence as check-in (422 OUT_OF_RANGE otherwise), records
 * time-spent (checkout − checkin) in `visit_duration_minutes`, and — when the SE
 * recorded NO order and NO collection for this customer that day — demands a
 * free-text reason (422 NO_OUTCOME_REASON until supplied, then written once).
 */
export async function checkOut(sql: SqlClient, context: CheckOutContext) {
  const [visit] = (await sql`
    /* get_visit_for_checkout */
    select
      v.id,
      v.executive_id as "executiveId",
      v.customer_id as "customerId",
      v.visit_date as "visitDate",
      v.check_in_time as "checkInTime",
      v.check_out_time as "checkOutTime",
      v.no_outcome_reason as "noOutcomeReason",
      c.latitude as "custLat",
      c.longitude as "custLng",
      bps.id as "stopId"
    from visits v
    join customers c on c.id = v.customer_id
    left join beat_plan_stops bps on bps.visit_id = v.id
    where v.id = ${context.visitId}::uuid
  `) as Row[];

  if (!visit) throw new ApiError("NOT_FOUND", "Visit not found.", 404);
  if (str(visit.executiveId) !== context.userId) {
    throw new ApiError("FORBIDDEN", "This visit is not yours.", 403);
  }
  if (visit.checkOutTime) {
    throw new ApiError("CONFLICT", "Visit is already checked out.", 409);
  }

  // Server-enforced geofence: must be within 100 m (minus GPS accuracy) of the
  // customer's saved location, same as check-in. Skipped only if the customer has
  // no saved location on file.
  const custLat = visit.custLat == null ? null : Number(visit.custLat);
  const custLng = visit.custLng == null ? null : Number(visit.custLng);
  if (custLat != null && custLng != null && !withinFence(custLat, custLng, context.latitude, context.longitude, context.accuracy)) {
    throw new ApiError("OUT_OF_RANGE", "You're too far from the shop to check out. Move within 100 m.", 422);
  }

  // Mandatory no-outcome reason: no order AND no collection by this SE for this
  // customer on the visit day → require a reason before closing the visit.
  const reason = context.reason?.trim() || null;
  if (!reason) {
    const [outcome] = (await sql`
      /* checkout_outcome_exists */
      select (
        exists (
          select 1 from orders o
          where o.customer_id = ${str(visit.customerId)}::uuid
            and o.sales_executive_id = ${context.userId}::uuid
            and o.order_date = ${str(visit.visitDate)}::date
            and o.order_status <> 'cancelled'
        )
        or exists (
          select 1 from collections cl
          where cl.customer_id = ${str(visit.customerId)}::uuid
            and cl.collected_by_user_id = ${context.userId}::uuid
            and cl.collection_date = ${str(visit.visitDate)}::date
        )
      ) as "hasOutcome"
    `) as Row[];
    if (!outcome?.hasOutcome) {
      throw new ApiError("NO_OUTCOME_REASON", "Add a reason for a visit with no order or collection.", 422);
    }
  }

  const checkInMs =
    visit.checkInTime instanceof Date
      ? visit.checkInTime.getTime()
      : new Date(str(visit.checkInTime)).getTime();
  const durationMinutes = Math.round((Date.now() - checkInMs) / 60000);

  await sql`
    /* update_visit_on_checkout */
    update visits
    set check_out_time         = now(),
        check_out_latitude     = ${context.latitude},
        check_out_longitude    = ${context.longitude},
        visit_duration_minutes = ${durationMinutes},
        -- write-once: keep an existing reason, otherwise store the supplied one.
        no_outcome_reason      = coalesce(no_outcome_reason, ${reason})
    where id = ${context.visitId}::uuid
  `;

  if (visit.stopId) {
    await sql`
      /* update_stop_on_checkout */
      update beat_plan_stops
      set stop_status = 'completed'
      where id = ${str(visit.stopId)}::uuid
    `;
  }

  // A no-outcome checkout → create a resolvable follow-up (supersedes any prior
  // open one for the customer). The SE's optional follow-up date rides along and
  // fires a reminder push from the cron when it arrives.
  if (reason) {
    await createCheckoutFollowup(sql, {
      customerId: str(visit.customerId),
      createdBy: context.userId,
      visitId: context.visitId,
      reason,
      followUpAt: context.followUpAt ?? null,
    });
  }

  return { visitId: context.visitId, durationMinutes, noOutcomeReason: reason ?? (visit.noOutcomeReason ? str(visit.noOutcomeReason) : null) };
}

/**
 * Midnight auto-close for visits left open past their IST day. The every-3-minute
 * cron runs this each tick: any visit from a PRIOR IST day that was never checked
 * out gets closed at the midnight ending its day (no GPS fix, so NULL duration —
 * it shows "—" on the web and is excluded from averages). Idempotent.
 */
export async function autoCloseStaleVisits(sql: SqlClient) {
  // Only the visit row is closed here (duration left NULL — no GPS fix). A beat
  // stop the SE checked into but never checked out of stays 'checked_in' (not
  // 'completed'): a midnight auto-close is not a real checkout, so it isn't "done".
  const rows = await sql`
    /* auto_close_stale_visits */
    update visits
    set check_out_time = ((visit_date + 1)::timestamp at time zone 'Asia/Kolkata')
    where check_out_time is null
      and visit_date < (now() at time zone 'Asia/Kolkata')::date
    returning id
  `;
  return { closed: rows.length };
}

export async function batchGpsPings(sql: SqlClient, context: BatchGpsContext) {
  // SEs stop being tracked at 8 PM IST; Logistics have no cutoff (a run ends
  // only when the driver ends it, even past midnight) → keep every point. Single
  // source of truth so ingestion always matches the session-close cutoff.
  const cutoffHour = trackingCutoffHour(context.role);
  const points =
    cutoffHour === null
      ? context.points
      : context.points.filter((p) => {
          const local = istHourOf(p.recordedAt);
          return local !== null && local.hour < cutoffHour;
        });
  if (points.length === 0) return { inserted: 0, sessionId: null };

  // Prefer the user's currently-active session so a run that crosses midnight
  // keeps ONE continuous session (its session_date stays the start day) instead
  // of splitting into a new day. Fall back to today's session (e.g. an SE's
  // already-closed day receiving an offline backlog), then create one.
  let [session] = await sql`
    /* get_active_gps_session */
    select id
    from gps_tracking_sessions
    where user_id = ${context.userId}::uuid
      and status = 'active'
    order by started_at desc nulls last, created_at desc
    limit 1
  ` as Row[];

  if (!session) {
    [session] = await sql`
      /* get_gps_session_today */
      select id
      from gps_tracking_sessions
      where user_id    = ${context.userId}::uuid
        and session_date = (now() at time zone 'Asia/Kolkata')::date
      limit 1
    ` as Row[];
  }

  if (!session) {
    [session] = await sql`
      /* create_gps_session */
      insert into gps_tracking_sessions (
        user_id, session_date, started_at, status
      )
      values (
        ${context.userId}::uuid,
        (now() at time zone 'Asia/Kolkata')::date,
        now(),
        'active'
      )
      returning id
    ` as Row[];
  }

  const sessionId = str(session.id);

  // One multi-row INSERT via array unnest instead of N awaited round-trips. A
  // phone flushing a long offline backlog would otherwise fire one Neon HTTP
  // subrequest per point and blow the Workers subrequest cap partway, so the
  // queue never drains (audit G-0401 — same fix already on the tracking-sessions
  // path). `returning id` yields the REAL inserted count (on-conflict dedupes),
  // not the candidate count the old loop reported.
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const accs = points.map((p) => p.accuracy ?? null);
  const bats = points.map((p) => p.batteryPercentage ?? null);
  const times = points.map((p) => p.recordedAt);

  const insertedRows = (await sql`
    /* insert_gps_points_batch */
    insert into gps_points (
      session_id, user_id, latitude, longitude, accuracy_meters, battery_percentage, recorded_at
    )
    select
      ${sessionId}::uuid, ${context.userId}::uuid, t.lat, t.lng, t.acc, t.bat, t.rec
    from unnest(
      ${lats}::numeric[], ${lngs}::numeric[], ${accs}::numeric[],
      ${bats}::int[], ${times}::timestamptz[]
    ) as t(lat, lng, acc, bat, rec)
    on conflict (user_id, recorded_at) do nothing
    returning id
  `) as Row[];

  return { inserted: insertedRows.length, sessionId };
}

/**
 * Close the user's active GPS session — called by the mobile End-day / End-run
 * button. Ends the active session regardless of its session_date so a Logistics
 * run that crossed midnight can still be closed. Idempotent: no active session
 * simply returns endedAt null.
 */
export async function endGpsSession(sql: SqlClient, context: { userId: string }) {
  // This user-scoped end is only reached by the mobile logout fallback (no
  // session id). If the field device is STILL actively pinging, the "end" is
  // almost certainly a *viewer's* logout on a shared account — so we refuse to
  // end an actively-tracking session and never kill a live run. A real end
  // (Logistics "End run") uses the session-specific /tracking-sessions/:id/end,
  // which is unaffected by this guard.
  const rows = await sql`
    /* end_gps_session */
    update gps_tracking_sessions s
    set status = 'ended', ended_at = now()
    where s.user_id = ${context.userId}::uuid
      and s.status = 'active'
      and not exists (
        select 1 from gps_points p
        where p.session_id = s.id
          and p.recorded_at > now() - interval '10 minutes'
      )
    returning s.id, s.ended_at as "endedAt"
  `;
  return { ended: rows.length > 0, endedAt: rows[0]?.endedAt ?? null };
}
