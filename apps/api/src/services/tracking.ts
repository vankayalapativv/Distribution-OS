import type { SqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";

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

function num(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function bool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    if (v === "true") return true;
    if (v === "false") return false;
  }
  return null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Display-quality gate: fixes worse than this (e.g. recorded indoors) are
 * excluded from the map view. Raw points stay in gps_points untouched.
 * Points with no reported accuracy are kept.
 */
const MAX_ACCURACY_METERS = 100;

export function assertTrackingDate(date: string): string {
  if (!DATE_RE.test(date)) {
    throw new ApiError("INVALID_FIELD", "date must be YYYY-MM-DD.", 422);
  }
  return date;
}

export type TrackingFreshnessStatus =
  | "fresh"
  | "delayed"
  | "locating"
  | "offline_upload_delayed"
  | "tracking_interrupted"
  | "gps_disabled"
  | "permission_missing"
  | "day_not_started"
  | "day_ended"
  | "signed_out";

const TRACKING_STATUS_LABELS: Record<TrackingFreshnessStatus, string> = {
  fresh: "Fresh",
  delayed: "Delayed",
  locating: "Locating…",
  offline_upload_delayed: "Offline/upload delayed",
  tracking_interrupted: "Tracking interrupted",
  gps_disabled: "GPS disabled",
  permission_missing: "Permission missing",
  day_not_started: "Day not started",
  day_ended: "Day ended",
  signed_out: "Signed out",
};

// The phone checks in with a device heartbeat every ~3 min independent of GPS.
// A heartbeat this recent proves the phone is reachable, online, and running —
// even when it hasn't produced a fresh GPS fix (e.g. stationary indoors). We
// only call tracking "interrupted" once these heartbeats ALSO stop.
const HEARTBEAT_REACHABLE_MINUTES = 12;

function ageMinutes(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, (now.getTime() - time) / 60_000);
}

// The IST calendar date + hour for a moment. IST is a fixed UTC+5:30 offset (no
// DST), so shifting the epoch and reading the UTC fields is exact.
function istParts(now: Date): { date: string; hour: number } {
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return { date: ist.toISOString().slice(0, 10), hour: ist.getUTCHours() };
}

// A sales executive's tracking day auto-ends at 8 PM IST (the same cutoff used for
// beats and the session-closing cron). Past this hour, today is over.
const SE_DAY_END_HOUR_IST = 20;

export function classifyTrackingFreshness(input: {
  sessionStatus: string | null;
  lastRecordedAt: string | null;
  lastHeartbeatAt: string | null;
  isLocationEnabled: boolean | null;
  foregroundPermission: string | null;
  backgroundPermission: string | null;
  isConnected: boolean | null;
  queuedPointCount: number | null;
  // True when the executive's working day is authoritatively over: we're viewing
  // a past date, or it's today and past the 8 PM IST auto-end cutoff. In that
  // case a stale session is "Day ended" (calm), not "Tracking interrupted" (alarm)
  // — see listTrackedExecutives. The auto-end is the business rule that closes SE
  // days, so this is a fact, not a guess, and stays correct even if the
  // session-closing cron never runs.
  dayIsOver?: boolean;
  // When the executive last signed out on their phone (best-effort beacon). Only
  // meaningful when it's the most recent thing we heard: a newer point/heartbeat
  // after a fresh sign-in supersedes it. A stale row whose latest signal is a
  // sign-out shows the calm, distinct "Signed out" — never the red
  // "Tracking interrupted" (which is reserved for an unexplained mid-day loss of
  // contact, e.g. a dead battery, that sends no beacon).
  signedOutAt?: string | null;
  now?: Date;
}): { trackingStatus: TrackingFreshnessStatus; trackingStatusLabel: string } {
  if (input.sessionStatus === "ended") {
    return { trackingStatus: "day_ended", trackingStatusLabel: TRACKING_STATUS_LABELS.day_ended };
  }
  if (input.foregroundPermission && input.foregroundPermission !== "granted") {
    return { trackingStatus: "permission_missing", trackingStatusLabel: TRACKING_STATUS_LABELS.permission_missing };
  }
  // Background location ("Allow all the time") is NOT required for tracking: the
  // day runs under a foreground service that captures location with foreground
  // permission. Some Android/expo versions report background as "undetermined"
  // even after the user grants it, so treating it as a hard blocker produces a
  // false red "Permission missing" status while pings flow fine. Background is
  // surfaced as a warning in the health reasons instead (foreground denial above
  // remains a genuine blocker).
  if (input.isLocationEnabled === false) {
    return { trackingStatus: "gps_disabled", trackingStatusLabel: TRACKING_STATUS_LABELS.gps_disabled };
  }
  if (input.sessionStatus !== "active") {
    return { trackingStatus: "day_not_started", trackingStatusLabel: TRACKING_STATUS_LABELS.day_not_started };
  }

  const now = input.now ?? new Date();
  const pointAge = ageMinutes(input.lastRecordedAt, now);
  const heartbeatAge = ageMinutes(input.lastHeartbeatAt, now);
  // "Reachable" = the phone is still checking in, so we know it's alive even
  // without a fresh GPS fix. This is what separates "locating" (benign) from
  // "tracking interrupted" (we've genuinely lost contact with the phone).
  const reachable = heartbeatAge !== null && heartbeatAge <= HEARTBEAT_REACHABLE_MINUTES;

  // The executive explicitly signed out on their phone and we've heard nothing
  // since (no newer point or heartbeat). This is an intentional stop — show the
  // calm, distinct "Signed out", not the red "Tracking interrupted" reserved for
  // an unexplained loss of contact. A fresh sign-in produces newer signals that
  // supersede this, so it clears itself.
  const signedOutAge = ageMinutes(input.signedOutAt ?? null, now);
  const signedOut =
    signedOutAge !== null &&
    (pointAge === null || signedOutAge <= pointAge) &&
    (heartbeatAge === null || signedOutAge <= heartbeatAge);
  if (signedOut) {
    return { trackingStatus: "signed_out", trackingStatusLabel: TRACKING_STATUS_LABELS.signed_out };
  }

  const staleStatus = (): { trackingStatus: TrackingFreshnessStatus; trackingStatusLabel: string } => {
    // The day is over (past date, or past the 8 PM IST cutoff today): a stale
    // session just means the executive is done for the day, not that we've lost a
    // live phone. Show the calm "Day ended", never the red "Tracking interrupted".
    if (input.dayIsOver) {
      return { trackingStatus: "day_ended", trackingStatusLabel: TRACKING_STATUS_LABELS.day_ended };
    }
    return reachable
      ? { trackingStatus: "locating", trackingStatusLabel: TRACKING_STATUS_LABELS.locating }
      : {
          trackingStatus: "tracking_interrupted",
          trackingStatusLabel: TRACKING_STATUS_LABELS.tracking_interrupted,
        };
  };

  if (pointAge === null) {
    // Session active but no GPS fix yet. A phone that's still heartbeating is
    // locating, not interrupted.
    return staleStatus();
  }
  if (pointAge <= 4) {
    return { trackingStatus: "fresh", trackingStatusLabel: TRACKING_STATUS_LABELS.fresh };
  }
  if (pointAge <= 8) {
    return { trackingStatus: "delayed", trackingStatusLabel: TRACKING_STATUS_LABELS.delayed };
  }
  if (pointAge <= 15 && (input.isConnected === false || (input.queuedPointCount ?? 0) > 0)) {
    return {
      trackingStatus: "offline_upload_delayed",
      trackingStatusLabel: TRACKING_STATUS_LABELS.offline_upload_delayed,
    };
  }
  if (pointAge <= 15) {
    return { trackingStatus: "delayed", trackingStatusLabel: TRACKING_STATUS_LABELS.delayed };
  }
  // GPS fix is stale (>15 min). Only "interrupted" if the phone has also stopped
  // heartbeating; otherwise it's reachable and simply hasn't got a fresh fix.
  return staleStatus();
}

/**
 * One row per sales executive who tracked on the given day: their session
 * status plus the latest recorded point. Day pings come from the mobile
 * Start-day flow (a point every 5 minutes into gps_points).
 */
export async function listTrackedExecutives(sql: SqlClient, date: string) {
  const rows = await sql`
    /* tracking_executives */
    with day_points as (
      select
        p.user_id,
        count(*) as point_count,
        max(p.recorded_at) as last_recorded_at
      from gps_points p
      where (p.recorded_at at time zone 'Asia/Kolkata')::date = ${date}::date
        and (p.accuracy_meters is null or p.accuracy_meters <= ${MAX_ACCURACY_METERS})
      group by p.user_id
    )
    select
      u.id as "userId",
      u.name,
      (select r.code from user_roles ur join roles r on r.id = ur.role_id
        where ur.user_id = u.id and r.code in ('SALES_EXECUTIVE', 'LOGISTICS') limit 1) as "role",
      s.status as "sessionStatus",
      s.started_at as "startedAt",
      s.ended_at as "endedAt",
      dp.point_count as "pointCount",
      lp.latitude as "lastLatitude",
      lp.longitude as "lastLongitude",
      lp.accuracy_meters as "lastAccuracyMeters",
      lp.recorded_at as "lastRecordedAt",
      ell.last_heartbeat_at as "lastHeartbeatAt",
      ell.last_signed_out_at as "signedOutAt",
      ell.battery_percentage as "batteryPercentage",
      ell.is_location_enabled as "isLocationEnabled",
      ell.foreground_permission as "foregroundPermission",
      ell.background_permission as "backgroundPermission",
      ell.notification_permission as "notificationPermission",
      ell.battery_optimization_status as "batteryOptimizationStatus",
      ell.network_type as "networkType",
      ell.is_connected as "isConnected",
      ell.queued_point_count as "queuedPointCount",
      ell.last_successful_sync_at as "lastSuccessfulSyncAt",
      s.total_distance_km as "totalDistanceKm",
      s.distance_algorithm_version as "distanceAlgorithmVersion",
      s.accepted_distance_point_count as "acceptedDistancePointCount",
      s.rejected_distance_point_count as "rejectedDistancePointCount",
      s.start_odometer as "startOdometer",
      s.end_odometer as "endOdometer"
    from day_points dp
    join users u on u.id = dp.user_id
    left join lateral (
      select latitude, longitude, accuracy_meters, recorded_at
      from gps_points
      where user_id = dp.user_id
        and recorded_at = dp.last_recorded_at
        and (accuracy_meters is null or accuracy_meters <= ${MAX_ACCURACY_METERS})
      order by created_at desc
      limit 1
    ) lp on true
    left join lateral (
      select
        status,
        started_at,
        ended_at,
        total_distance_km,
        distance_algorithm_version,
        accepted_distance_point_count,
        rejected_distance_point_count,
        start_odometer,
        end_odometer
      from gps_tracking_sessions
      where user_id = dp.user_id and session_date = ${date}::date
      order by created_at desc
      limit 1
    ) s on true
    left join executive_latest_locations ell on ell.user_id = dp.user_id
    order by lp.recorded_at desc
  ` as Row[];

  const now = new Date();
  const today = istParts(now);
  // Viewing a past date → the day is over for everyone. Today → only over once
  // past the 8 PM IST SE cutoff (applied per-row below, SE-only: Logistics keep a
  // later window and end their runs explicitly).
  const pastDate = date < today.date;
  const seCutoffPassed = date === today.date && today.hour >= SE_DAY_END_HOUR_IST;
  return rows.map((r) => {
    const sessionStatus = nullStr(r.sessionStatus);
    const lastRecordedAt = nullStr(r.lastRecordedAt);
    const lastHeartbeatAt = nullStr(r.lastHeartbeatAt);
    const queuedPointCount = num(r.queuedPointCount);
    const isSalesExecutive = nullStr(r.role) === "SALES_EXECUTIVE";
    const dayIsOver = pastDate || (isSalesExecutive && seCutoffPassed);
    const freshness = classifyTrackingFreshness({
      sessionStatus,
      lastRecordedAt,
      lastHeartbeatAt,
      isLocationEnabled: bool(r.isLocationEnabled),
      foregroundPermission: nullStr(r.foregroundPermission),
      backgroundPermission: nullStr(r.backgroundPermission),
      isConnected: bool(r.isConnected),
      queuedPointCount,
      dayIsOver,
      signedOutAt: nullStr(r.signedOutAt),
      now,
    });
    return {
      userId: str(r.userId),
      name: str(r.name),
      role: str(r.role),
      sessionStatus,
      startedAt: nullStr(r.startedAt),
      endedAt: nullStr(r.endedAt),
      pointCount: num(r.pointCount) ?? 0,
      lastLatitude: num(r.lastLatitude),
      lastLongitude: num(r.lastLongitude),
      lastAccuracyMeters: num(r.lastAccuracyMeters),
      lastRecordedAt,
      locationLabel: "Latest known location",
      lastHeartbeatAt,
      batteryPercentage: num(r.batteryPercentage),
      isLocationEnabled: bool(r.isLocationEnabled),
      foregroundPermission: nullStr(r.foregroundPermission),
      backgroundPermission: nullStr(r.backgroundPermission),
      notificationPermission: nullStr(r.notificationPermission),
      batteryOptimizationStatus: nullStr(r.batteryOptimizationStatus),
      networkType: nullStr(r.networkType),
      isConnected: bool(r.isConnected),
      queuedPointCount: queuedPointCount ?? 0,
      lastSuccessfulSyncAt: nullStr(r.lastSuccessfulSyncAt),
      totalDistanceKm: num(r.totalDistanceKm),
      distanceAlgorithmVersion: nullStr(r.distanceAlgorithmVersion),
      acceptedDistancePointCount: num(r.acceptedDistancePointCount) ?? 0,
      rejectedDistancePointCount: num(r.rejectedDistancePointCount) ?? 0,
      startOdometer: num(r.startOdometer),
      endOdometer: num(r.endOdometer),
      ...freshness,
    };
  });
}

/**
 * Device-health roster: EVERY active tracked field user (SE + Logistics) with
 * their latest device/permission heartbeat and today's raw ping count — so the
 * phones that are failing (background permission denied, no pings, stale) show
 * up, unlike the map query which only lists users who already have points.
 */
export async function listDeviceHealth(sql: SqlClient, date: string) {
  const rows = (await sql`
    /* device_health */
    select
      u.id as "userId",
      u.name,
      h.manufacturer,
      h.model,
      h.android_version as "androidVersion",
      h.app_version as "appVersion",
      h.background_permission as "backgroundPermission",
      h.foreground_permission as "foregroundPermission",
      h.battery_optimization_status as "batteryOptimizationStatus",
      h.is_location_enabled as "isLocationEnabled",
      h.is_low_power_mode_enabled as "lowPowerMode",
      h.network_type as "networkType",
      h.is_connected as "isConnected",
      h.battery_percentage as "batteryPercentage",
      h.queued_point_count as "queuedPointCount",
      h.last_successful_sync_at as "lastSuccessfulSyncAt",
      h.captured_at as "lastHeartbeatAt",
      dp."todayPoints",
      dp."lastRecordedAt",
      s.started_at as "startedAt",
      s.ended_at as "endedAt",
      s.status as "sessionStatus"
    from users u
    join user_roles ur on ur.user_id = u.id
    join roles r on r.id = ur.role_id and r.code in ('SALES_EXECUTIVE', 'LOGISTICS')
    left join lateral (
      select manufacturer, model, android_version, app_version, background_permission,
             foreground_permission, battery_optimization_status, is_location_enabled,
             is_low_power_mode_enabled, network_type, is_connected, battery_percentage,
             queued_point_count, last_successful_sync_at, captured_at
      from tracking_device_heartbeats
      where user_id = u.id
      order by captured_at desc
      limit 1
    ) h on true
    left join lateral (
      select count(*)::int as "todayPoints", max(recorded_at) as "lastRecordedAt"
      from gps_points
      where user_id = u.id and (recorded_at at time zone 'Asia/Kolkata')::date = ${date}::date
    ) dp on true
    left join lateral (
      select started_at, ended_at, status
      from gps_tracking_sessions
      where user_id = u.id and session_date = ${date}::date
      order by created_at desc
      limit 1
    ) s on true
    where u.status = 'active'
    order by u.name
  `) as Row[];

  return rows.map((r) => ({
    userId: str(r.userId),
    name: str(r.name),
    manufacturer: nullStr(r.manufacturer),
    model: nullStr(r.model),
    androidVersion: nullStr(r.androidVersion),
    appVersion: nullStr(r.appVersion),
    backgroundPermission: nullStr(r.backgroundPermission),
    foregroundPermission: nullStr(r.foregroundPermission),
    batteryOptimizationStatus: nullStr(r.batteryOptimizationStatus),
    isLocationEnabled: bool(r.isLocationEnabled),
    lowPowerMode: bool(r.lowPowerMode),
    networkType: nullStr(r.networkType),
    isConnected: bool(r.isConnected),
    batteryPercentage: num(r.batteryPercentage),
    queuedPointCount: num(r.queuedPointCount) ?? 0,
    lastSuccessfulSyncAt: nullStr(r.lastSuccessfulSyncAt),
    lastHeartbeatAt: nullStr(r.lastHeartbeatAt),
    todayPoints: num(r.todayPoints) ?? 0,
    lastRecordedAt: nullStr(r.lastRecordedAt),
    startedAt: nullStr(r.startedAt),
    endedAt: nullStr(r.endedAt),
    sessionStatus: nullStr(r.sessionStatus),
  }));
}

/** Full ordered route for one executive on one day (for the map trail). */
export async function getExecutiveRoute(sql: SqlClient, userId: string, date: string) {
  const rows = await sql`
    /* tracking_route */
    select
      latitude,
      longitude,
      accuracy_meters as "accuracyMeters",
      recorded_at as "recordedAt"
    from gps_points
    where user_id = ${userId}::uuid
      and (recorded_at at time zone 'Asia/Kolkata')::date = ${date}::date
      and (accuracy_meters is null or accuracy_meters <= ${MAX_ACCURACY_METERS})
    order by recorded_at
    limit 2000
  ` as Row[];

  return rows.map((r) => ({
    latitude: num(r.latitude) ?? 0,
    longitude: num(r.longitude) ?? 0,
    accuracyMeters: num(r.accuracyMeters),
    recordedAt: str(r.recordedAt),
  }));
}

/**
 * One executive's check-ins for a day (the visited points highlighted on the
 * map). Each carries its GPS fix, the customer, the check-in time, whether the
 * visit was planned or unplanned, and the visit OUTCOMES — orders (oil litres
 * net of returns) and collections (₹) — inferred by same
 * executive + customer + date (the same rule the dashboard Visits drill-down
 * uses; visits carry no FK to the order/collection they produced).
 */
export async function getExecutiveCheckins(sql: SqlClient, userId: string, date: string) {
  const rows = (await sql`
    /* tracking_checkins */
    select
      v.id as "visitId",
      v.customer_id as "customerId",
      cu.legal_name as "customerName",
      v.check_in_latitude as "lat",
      v.check_in_longitude as "lng",
      v.check_in_time as "checkInAt",
      v.planned_or_unplanned as "planned",
      coalesce(og.orders, '[]'::json) as "orders",
      coalesce(cg.collections, '[]'::json) as "collections"
    from visits v
    join customers cu on cu.id = v.customer_id
    left join lateral (
      select json_agg(x order by x.created_at) as orders
      from (
        select
          o.id, o.order_code as code, o.created_at,
          coalesce(sum((oi.quantity_units * oi.pack_size_litres) - coalesce(ret.rlitres, 0))
            filter (where oi.product_id is not null), 0)::numeric as litres
        from orders o
        left join order_items oi on oi.order_id = o.id
        left join (
          select order_item_id, sum(litres) as rlitres
          from sales_return_items where kind = 'oil' group by order_item_id
        ) ret on ret.order_item_id = oi.id
        where o.customer_id = v.customer_id
          and o.sales_executive_id = v.executive_id
          and o.order_date = v.visit_date
          and o.order_status <> 'cancelled'
        group by o.id, o.order_code, o.created_at
      ) x
    ) og on true
    left join lateral (
      select json_agg(json_build_object(
        'id', c.id, 'code', c.collection_code, 'amount', c.collection_amount
      ) order by c.created_at) as collections
      from collections c
      where c.customer_id = v.customer_id
        and c.collected_by_user_id = v.executive_id
        and c.collection_date = v.visit_date
    ) cg on true
    where v.executive_id = ${userId}::uuid
      and v.visit_date = ${date}::date
      and v.check_in_latitude is not null
      and v.check_in_longitude is not null
    order by v.check_in_time
  `) as Row[];

  return rows.map((r) => ({
    visitId: str(r.visitId),
    customerId: str(r.customerId),
    customerName: str(r.customerName),
    lat: num(r.lat) ?? 0,
    lng: num(r.lng) ?? 0,
    checkInAt: nullStr(r.checkInAt),
    planned: str(r.planned) === "planned" ? "planned" : "unplanned",
    orders: Array.isArray(r.orders)
      ? (r.orders as Row[]).map((o) => ({
          id: str(o.id),
          code: str(o.code),
          litres: num(o.litres) ?? 0,
        }))
      : [],
    collections: Array.isArray(r.collections)
      ? (r.collections as Row[]).map((c) => ({
          id: str(c.id),
          code: str(c.code),
          amount: num(c.amount) ?? 0,
        }))
      : [],
  }));
}
