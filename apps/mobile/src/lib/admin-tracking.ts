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

/** Collection-dues ageing bucket — the enterprise band's key, i.e. its ordinal as
 *  a string ("0".."N-1"), or null when the customer has no outstanding. Bands are
 *  per-enterprise now, so the old fixed keys ("0_30"…) are gone (web parity). */
export type DuesBucketKey = string;

/** One collection-dues band as served by /dashboard/map (mirrors the API's
 *  DuesBand) — its key is the ordinal as a string; labels/ranges are per-enterprise. */
export interface DuesBand {
  key: string;
  ordinal: number;
  fromDays: number;
  toDays: number | null;
  label: string;
}

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

/** Every customer with coordinates (always-on customer layer) + the enterprise's
 *  dues bands (for the pin labels). Bucket colour is ordinal; the label is the
 *  enterprise's own band label, so both come from /dashboard/map. */
export async function fetchMapCustomers(): Promise<{ customers: MapCustomer[]; bands: DuesBand[] }> {
  const data = await apiFetch<{ customers: MapCustomer[]; bands: DuesBand[] }>("/dashboard/map", {
    token: token(),
  });
  return {
    customers: (data.customers ?? []).filter((c) => c.lat != null && c.lng != null),
    bands: data.bands ?? [],
  };
}

/** One rep's check-ins for `date` — visit locations + the orders/collections made. */
export async function fetchCheckins(userId: string, date: string): Promise<CheckinMarker[]> {
  const data = await apiFetch<{ checkins: CheckinMarker[] }>(
    `/tracking/checkins?userId=${userId}&date=${date}`,
    { token: token() },
  );
  return (data.checkins ?? []).filter((c) => c.lat != null && c.lng != null);
}
