import { apiFetch } from "./api";
import { useAuth } from "./auth";

/** A tracked rep (SE or Logistics) with their latest position for the day. */
export interface TrackedExecutive {
  userId: string;
  name: string;
  role: string; // "SALES_EXECUTIVE" | "LOGISTICS"
  sessionStatus: string | null;
  pointCount: number;
  lastLatitude: number | null;
  lastLongitude: number | null;
  lastRecordedAt: string | null;
}

export interface RoutePoint {
  latitude: number;
  longitude: number;
  recordedAt: string;
}

const token = () => useAuth.getState().token;

/** Today's date in IST (yyyy-mm-dd) — the field team's day. */
export function istToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** Everyone tracked on `date` (SE + Logistics), each with their latest ping. */
export async function fetchTrackedExecutives(date: string): Promise<TrackedExecutive[]> {
  const data = await apiFetch<{ executives: TrackedExecutive[] }>(
    `/tracking/executives?date=${date}`,
    { token: token() },
  );
  return data.executives ?? [];
}

/** One rep's ordered GPS trail for `date` (the map polyline). */
export async function fetchExecutiveRoute(userId: string, date: string): Promise<RoutePoint[]> {
  const data = await apiFetch<{ points: RoutePoint[] }>(
    `/tracking/route?userId=${userId}&date=${date}`,
    { token: token() },
  );
  return data.points ?? [];
}

/** A rep is "live" when their last ping is < 12 minutes old (mirrors web). */
export function isLive(ex: TrackedExecutive): boolean {
  if (!ex.lastRecordedAt) return false;
  return Date.now() - new Date(ex.lastRecordedAt).getTime() < 12 * 60 * 1000;
}

// ── Map overlays (customer pins + visit check-ins) ───────────────────────────
// Mirrors the web Live-Tracking map: every customer plotted (coloured by dues
// ageing bucket) and, for the selected rep, where they checked in that day with
// the orders/collections made there.

/** Collection-dues ageing bucket — same keys as the web Dues card. */
export type DuesBucketKey = "0_30" | "30_45" | "45_60" | "60_plus";

/** A customer pin on the tracking map (from GET /dashboard/map). */
export interface MapCustomer {
  id: string;
  name: string;
  code: string;
  city: string | null;
  lat: number;
  lng: number;
  executiveId: string | null;
  executiveName: string | null;
  outstanding: number;
  ageDays: number | null;
  bucket: DuesBucketKey | null;
  /** Days since the most recent non-cancelled order, or null if never. */
  lastOrderDays: number | null;
  /** Days since the most recent non-rejected collection, or null if never. */
  lastCollectionDays: number | null;
  active: boolean;
}

/** An order made during a visit (oil litres, net of returns). */
export interface CheckinOrder {
  id: string;
  code: string;
  litres: number;
}

/** A collection made during a visit (₹). */
export interface CheckinCollection {
  id: string;
  code: string;
  amount: number;
}

/** A check-in pin for the selected rep's day (from GET /tracking/checkins). */
export interface CheckinMarker {
  visitId: string;
  customerId: string;
  customerName: string;
  lat: number;
  lng: number;
  checkInAt: string | null;
  planned: "planned" | "unplanned";
  orders: CheckinOrder[];
  collections: CheckinCollection[];
}

/** Every customer with coordinates, for the always-on customer layer. */
export async function fetchMapCustomers(): Promise<MapCustomer[]> {
  const data = await apiFetch<{ customers: MapCustomer[] }>("/dashboard/map", { token: token() });
  return (data.customers ?? []).filter((c) => c.lat != null && c.lng != null);
}

/** One rep's check-ins for `date` — visit locations + the orders/collections made. */
export async function fetchCheckins(userId: string, date: string): Promise<CheckinMarker[]> {
  const data = await apiFetch<{ checkins: CheckinMarker[] }>(
    `/tracking/checkins?userId=${userId}&date=${date}`,
    { token: token() },
  );
  return (data.checkins ?? []).filter((c) => c.lat != null && c.lng != null);
}
