import type { SqlClient } from "../lib/db";

type Row = Record<string, unknown>;

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
}

function num(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export type TrackingPointQualityReason =
  | "INVALID_COORDINATES"
  | "POOR_ACCURACY"
  | "STALE_POINT"
  | "IMPOSSIBLE_SPEED";

export interface TrackingDistancePoint {
  pointId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  recordedAt: string;
}

export interface TrackingPointQuality {
  pointId: string;
  qualityStatus: "accepted" | "rejected";
  qualityReason: TrackingPointQualityReason | null;
  isAcceptedForDistance: boolean;
}

export interface TrackingDistanceSegment {
  fromPointId: string;
  toPointId: string;
  distanceKm: number;
  durationSeconds: number;
  speedKmph: number;
}

export interface TrackingDistanceResult {
  totalDistanceKm: number;
  acceptedPointCount: number;
  rejectedPointCount: number;
  pointQualities: TrackingPointQuality[];
  segments: TrackingDistanceSegment[];
  algorithmVersion: string;
}

export interface TrackingDistanceOptions {
  maxAccuracyMeters?: number;
  maxSpeedKmph?: number;
  minDistanceMeters?: number;
}

const EARTH_RADIUS_KM = 6371.0088;
const DEFAULT_MAX_ACCURACY_METERS = 75;
const DEFAULT_MAX_SPEED_KMPH = 140;
const DEFAULT_MIN_DISTANCE_METERS = 20;
export const TRACKING_DISTANCE_ALGORITHM_VERSION = "filtered-haversine-v1";

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function haversineKm(a: TrackingDistancePoint, b: TrackingDistancePoint): number {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function hasValidCoordinates(point: TrackingDistancePoint): boolean {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    point.longitude >= -180 &&
    point.longitude <= 180
  );
}

interface DistanceLimits {
  maxAccuracyMeters: number;
  maxSpeedKmph: number;
  minDistanceMeters: number;
}

type PointDecision =
  | { status: "rejected"; reason: TrackingPointQuality["qualityReason"] }
  | { status: "accepted"; segment: TrackingDistanceSegment | null };

/** Classify one point against the previous accepted one: reject (with a reason)
 *  for bad coordinates/accuracy/time/speed, else accept — carrying the segment to
 *  the last accepted point when the hop clears the minimum distance. Pure. */
function classifyPoint(
  point: TrackingDistancePoint,
  lastAccepted: TrackingDistancePoint | null,
  limits: DistanceLimits,
): PointDecision {
  const recordedMs = new Date(point.recordedAt).getTime();
  if (!hasValidCoordinates(point) || !Number.isFinite(recordedMs)) {
    return { status: "rejected", reason: "INVALID_COORDINATES" };
  }
  if (point.accuracyMeters != null && point.accuracyMeters > limits.maxAccuracyMeters) {
    return { status: "rejected", reason: "POOR_ACCURACY" };
  }
  if (!lastAccepted) return { status: "accepted", segment: null };

  const previousMs = new Date(lastAccepted.recordedAt).getTime();
  const durationSeconds = (recordedMs - previousMs) / 1000;
  if (durationSeconds <= 0) return { status: "rejected", reason: "STALE_POINT" };

  const distanceKm = haversineKm(lastAccepted, point);
  const speedKmph = distanceKm / (durationSeconds / 3600);
  if (speedKmph > limits.maxSpeedKmph) return { status: "rejected", reason: "IMPOSSIBLE_SPEED" };

  if (distanceKm * 1000 >= limits.minDistanceMeters) {
    return {
      status: "accepted",
      segment: { fromPointId: lastAccepted.pointId, toPointId: point.pointId, distanceKm, durationSeconds, speedKmph },
    };
  }
  return { status: "accepted", segment: null };
}

export function calculateTrackingDistance(
  points: TrackingDistancePoint[],
  options: TrackingDistanceOptions = {},
): TrackingDistanceResult {
  const maxAccuracyMeters = options.maxAccuracyMeters ?? DEFAULT_MAX_ACCURACY_METERS;
  const maxSpeedKmph = options.maxSpeedKmph ?? DEFAULT_MAX_SPEED_KMPH;
  const minDistanceMeters = options.minDistanceMeters ?? DEFAULT_MIN_DISTANCE_METERS;

  const ordered = [...points].sort((a, b) => {
    const timeDiff = new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime();
    return timeDiff || a.pointId.localeCompare(b.pointId);
  });

  const pointQualities: TrackingPointQuality[] = [];
  const segments: TrackingDistanceSegment[] = [];
  let lastAccepted: TrackingDistancePoint | null = null;
  let totalDistanceKm = 0;

  const limits: DistanceLimits = { maxAccuracyMeters, maxSpeedKmph, minDistanceMeters };
  for (const point of ordered) {
    const decision = classifyPoint(point, lastAccepted, limits);
    if (decision.status === "rejected") {
      pointQualities.push({
        pointId: point.pointId,
        qualityStatus: "rejected",
        qualityReason: decision.reason,
        isAcceptedForDistance: false,
      });
      continue;
    }

    if (decision.segment) {
      totalDistanceKm += decision.segment.distanceKm;
      segments.push(decision.segment);
    }

    pointQualities.push({
      pointId: point.pointId,
      qualityStatus: "accepted",
      qualityReason: null,
      isAcceptedForDistance: true,
    });
    lastAccepted = point;
  }

  const acceptedPointCount = pointQualities.filter((p) => p.isAcceptedForDistance).length;
  return {
    totalDistanceKm,
    acceptedPointCount,
    rejectedPointCount: pointQualities.length - acceptedPointCount,
    pointQualities,
    segments,
    algorithmVersion: TRACKING_DISTANCE_ALGORITHM_VERSION,
  };
}

export async function recalculateTrackingSessionDistance(
  sql: SqlClient,
  trackingSessionId: string,
): Promise<TrackingDistanceResult> {
  const rows = await sql`
    /* select_tracking_points_for_distance */
    select
      id as "pointId",
      latitude,
      longitude,
      accuracy_meters as "accuracyMeters",
      recorded_at as "recordedAt"
    from gps_points
    where session_id = ${trackingSessionId}::uuid
    order by recorded_at, created_at
  ` as Row[];

  const result = calculateTrackingDistance(
    rows.map((row) => ({
      pointId: str(row.pointId),
      latitude: num(row.latitude) ?? Number.NaN,
      longitude: num(row.longitude) ?? Number.NaN,
      accuracyMeters: num(row.accuracyMeters),
      recordedAt: str(row.recordedAt),
    })),
  );

  // One set-based update instead of a per-point round-trip. The old loop issued
  // N awaited UPDATEs on every insert batch — the Workers per-row subrequest
  // antipattern (audit G-0401), which risks the subrequest cap on long days.
  if (result.pointQualities.length > 0) {
    const ids = result.pointQualities.map((q) => q.pointId);
    const statuses = result.pointQualities.map((q) => q.qualityStatus);
    const reasons = result.pointQualities.map((q) => q.qualityReason);
    const accepted = result.pointQualities.map((q) => q.isAcceptedForDistance);
    await sql`
      /* update_tracking_point_quality_bulk */
      update gps_points g
      set
        quality_status = v.qs,
        quality_reason = v.qr,
        is_accepted_for_distance = v.acc
      from unnest(${ids}::uuid[], ${statuses}::text[], ${reasons}::text[], ${accepted}::boolean[]) as v(id, qs, qr, acc)
      where g.id = v.id
    `;
  }

  await sql`
    /* update_tracking_session_distance_summary */
    update gps_tracking_sessions
    set
      total_distance_km = ${result.totalDistanceKm},
      distance_algorithm_version = ${result.algorithmVersion},
      accepted_distance_point_count = ${result.acceptedPointCount},
      rejected_distance_point_count = ${result.rejectedPointCount}
    where id = ${trackingSessionId}::uuid
  `;

  return result;
}
