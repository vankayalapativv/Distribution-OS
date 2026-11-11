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

export interface DwellCustomer {
  customerId: string;
  customerName: string;
  latitude: number;
  longitude: number;
}

export interface DwellPoint {
  pointId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  recordedAt: string;
}

export interface CustomerDwellEvent {
  customerId: string;
  customerName: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  pointCount: number;
  source: "gps_observed";
}

export interface DetectCustomerDwellInput {
  customers: DwellCustomer[];
  points: DwellPoint[];
  geofenceRadiusMeters?: number;
  minimumDwellMinutes?: number;
  minimumConsecutivePoints?: number;
}

const EARTH_RADIUS_KM = 6371.0088;
const DEFAULT_GEOFENCE_RADIUS_METERS = 100;
const DEFAULT_MINIMUM_DWELL_MINUTES = 6;
const DEFAULT_MINIMUM_CONSECUTIVE_POINTS = 3;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * 1000;
}

function nearestCustomer(
  point: DwellPoint,
  customers: DwellCustomer[],
  geofenceRadiusMeters: number,
): DwellCustomer | null {
  let nearest: { customer: DwellCustomer; meters: number } | null = null;
  for (const customer of customers) {
    const meters = distanceMeters(point, customer);
    const accuracy = point.accuracyMeters ?? 0;
    if (meters > geofenceRadiusMeters + accuracy) continue;
    if (!nearest || meters < nearest.meters) nearest = { customer, meters };
  }
  return nearest?.customer ?? null;
}

function maybeDwellEvent(
  customer: DwellCustomer | null,
  points: DwellPoint[],
  minimumDwellMinutes: number,
  minimumConsecutivePoints: number,
): CustomerDwellEvent | null {
  if (!customer || points.length < minimumConsecutivePoints) return null;
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return null;
  const durationMinutes = Math.round((new Date(last.recordedAt).getTime() - new Date(first.recordedAt).getTime()) / 60000);
  if (durationMinutes < minimumDwellMinutes) return null;
  return {
    customerId: customer.customerId,
    customerName: customer.customerName,
    startedAt: first.recordedAt,
    endedAt: last.recordedAt,
    durationMinutes,
    pointCount: points.length,
    source: "gps_observed",
  };
}

export function detectCustomerDwell(input: DetectCustomerDwellInput): CustomerDwellEvent[] {
  const geofenceRadiusMeters = input.geofenceRadiusMeters ?? DEFAULT_GEOFENCE_RADIUS_METERS;
  const minimumDwellMinutes = input.minimumDwellMinutes ?? DEFAULT_MINIMUM_DWELL_MINUTES;
  const minimumConsecutivePoints = input.minimumConsecutivePoints ?? DEFAULT_MINIMUM_CONSECUTIVE_POINTS;
  const ordered = [...input.points].sort((a, b) => {
    const timeDiff = new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime();
    return timeDiff || a.pointId.localeCompare(b.pointId);
  });

  const events: CustomerDwellEvent[] = [];
  let currentCustomer: DwellCustomer | null = null;
  let currentPoints: DwellPoint[] = [];

  for (const point of ordered) {
    const customer = nearestCustomer(point, input.customers, geofenceRadiusMeters);
    if (customer && currentCustomer && customer.customerId === currentCustomer.customerId) {
      currentPoints.push(point);
      continue;
    }

    const event = maybeDwellEvent(
      currentCustomer,
      currentPoints,
      minimumDwellMinutes,
      minimumConsecutivePoints,
    );
    if (event) events.push(event);

    currentCustomer = customer;
    currentPoints = customer ? [point] : [];
  }

  const finalEvent = maybeDwellEvent(
    currentCustomer,
    currentPoints,
    minimumDwellMinutes,
    minimumConsecutivePoints,
  );
  if (finalEvent) events.push(finalEvent);

  return events;
}

export async function recalculateTrackingSessionDwell(
  sql: SqlClient,
  trackingSessionId: string,
): Promise<CustomerDwellEvent[]> {
  const [session] = await sql`
    /* select_tracking_session_for_dwell */
    select
      id as "sessionId",
      user_id as "userId"
    from gps_tracking_sessions
    where id = ${trackingSessionId}::uuid
    limit 1
  ` as Row[];

  if (!session) return [];

  await sql`
    /* delete_tracking_session_dwell */
    delete from tracking_customer_dwell_events
    where tracking_session_id = ${trackingSessionId}::uuid
      and source = 'gps_observed'
  `;

  const customers = await sql`
    /* select_customers_for_dwell */
    select
      id as "customerId",
      legal_name as "customerName",
      latitude,
      longitude
    from customers
    where latitude is not null
      and longitude is not null
      and status = 'active'
  ` as Row[];

  const points = await sql`
    /* select_tracking_points_for_dwell */
    select
      id as "pointId",
      latitude,
      longitude,
      accuracy_meters as "accuracyMeters",
      recorded_at as "recordedAt"
    from gps_points
    where session_id = ${trackingSessionId}::uuid
      and coalesce(is_accepted_for_distance, false) = true
    order by recorded_at, created_at
  ` as Row[];

  const events = detectCustomerDwell({
    customers: customers
      .map((row) => ({
        customerId: str(row.customerId),
        customerName: str(row.customerName),
        latitude: num(row.latitude) ?? Number.NaN,
        longitude: num(row.longitude) ?? Number.NaN,
      }))
      .filter((customer) => Number.isFinite(customer.latitude) && Number.isFinite(customer.longitude)),
    points: points.map((row) => ({
      pointId: str(row.pointId),
      latitude: num(row.latitude) ?? Number.NaN,
      longitude: num(row.longitude) ?? Number.NaN,
      accuracyMeters: num(row.accuracyMeters),
      recordedAt: str(row.recordedAt),
    })),
  });

  // One multi-row insert instead of a per-event round-trip (Workers subrequest
  // antipattern, audit G-0401).
  if (events.length > 0) {
    await sql`
      /* insert_tracking_session_dwell_bulk */
      insert into tracking_customer_dwell_events (
        tracking_session_id, user_id, customer_id, source,
        started_at, ended_at, duration_minutes, point_count
      )
      select
        ${trackingSessionId}::uuid, ${str(session.userId)}::uuid,
        v.customer_id, v.source, v.started_at::timestamptz, v.ended_at::timestamptz,
        v.duration_minutes, v.point_count
      from unnest(
        ${events.map((e) => e.customerId)}::uuid[],
        ${events.map((e) => e.source)}::text[],
        ${events.map((e) => e.startedAt)}::text[],
        ${events.map((e) => e.endedAt)}::text[],
        ${events.map((e) => e.durationMinutes)}::numeric[],
        ${events.map((e) => e.pointCount)}::int[]
      ) as v(customer_id, source, started_at, ended_at, duration_minutes, point_count)
    `;
  }

  return events;
}
