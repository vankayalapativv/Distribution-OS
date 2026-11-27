import type { MapMarker, MapRoute } from "vardhan-maps/react-native";
import {
  isLive,
  type CheckinMarker,
  type MapCustomer,
  type RoutePoint,
  type TrackedExecutive,
} from "../../lib/admin-tracking";
import { bucketColor, CHECKIN_PLANNED, CHECKIN_UNPLANNED } from "../../lib/tracking-overlays";

export const INDIA_CENTER: [number, number] = [22.5, 80.0];
export const INDIA_ZOOM = 4;
const LIVE = "#16a34a"; // green — fresh/live rep
const STALE = "#9ca3af"; // grey — stale rep
export const ROUTE_LINE = "#94a3b8";
export const ROUTE_BEAD = "#475569";

const IST_TIME = new Intl.DateTimeFormat("en-IN", {
  hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
});

/** A tapped marker is matched back to its data by exact coordinates. */
export function coordKey(lat: number, lng: number): string {
  return `${lat},${lng}`;
}

export function markerColor(live: boolean): string {
  return live ? LIVE : STALE;
}

export function buildRepMarkers(visible: TrackedExecutive[]): MapMarker[] {
  return visible.map((e) => ({
    lat: e.lastLatitude as number,
    lng: e.lastLongitude as number,
    label: e.name,
    permanent: true,
    color: markerColor(isLive(e)),
    radius: 7,
  }));
}

export function buildCustomerMarkers(customers: MapCustomer[]): MapMarker[] {
  return customers.map((c) => ({ lat: c.lat, lng: c.lng, label: c.name, color: bucketColor(c.bucket), radius: 6 }));
}

export function buildCheckinMarkers(checkins: CheckinMarker[]): MapMarker[] {
  return checkins.map((c) => ({
    lat: c.lat,
    lng: c.lng,
    label: c.customerName,
    color: c.planned === "planned" ? CHECKIN_PLANNED : CHECKIN_UNPLANNED,
    radius: 9,
  }));
}

/** The selected rep's trail, or an invisible fly-target while it still loads. */
export function buildRoutes(
  routeReady: boolean,
  route: RoutePoint[],
  selectedExec: TrackedExecutive | undefined,
): MapRoute[] {
  if (routeReady) {
    return [{
      points: route.map((p) => ({ lat: p.latitude, lng: p.longitude, label: IST_TIME.format(new Date(p.recordedAt)) })),
      color: ROUTE_LINE, weight: 3, opacity: 0.9, showPoints: true, pointColor: ROUTE_BEAD, pointRadius: 3.5,
    }];
  }
  if (selectedExec?.lastLatitude != null && selectedExec.lastLongitude != null) {
    const pt = { lat: selectedExec.lastLatitude, lng: selectedExec.lastLongitude };
    return [{ points: [pt, pt], color: "rgba(0,0,0,0)", weight: 0 }];
  }
  return [];
}

/** Camera fit key: fly to the trail, else the just-selected rep, else all markers. */
export function computeFitKey(
  routeReady: boolean,
  route: RoutePoint[],
  selectedId: string | null,
  markerCount: number,
): string | undefined {
  if (routeReady) return `r:${route[0]?.recordedAt}`;
  if (selectedId) return `s:${selectedId}`;
  if (markerCount) return `all:${markerCount}`;
  return undefined;
}

