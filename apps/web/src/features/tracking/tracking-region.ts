import { districtOf } from "@/features/dashboard/map/district-helpers";
import type { MapCustomer } from "@/features/dashboard/map/map-helpers";
import type { RoutePoint, TrackedExecutive } from "./tracking-api";

/** The set of states (by canonical name) the day's activity touches: where the
 *  customers are, PLUS where the executives' live positions and their GPS route
 *  points fell today. Geometric — point-in-polygon of each coordinate against the
 *  state boundaries — so the Live-Tracking map follows the real operating region
 *  (no hardcoded state) and still frames an executive who roamed into a neighbour.
 *  Pure. */
export function operatingStatesOf(
  states: readonly GeoJSON.Feature[],
  customers: MapCustomer[],
  executives: TrackedExecutive[],
  routePoints: RoutePoint[],
): string[] {
  const set = new Set<string>();
  const add = (lng: number, lat: number) => {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    const s = districtOf(states, lng, lat);
    if (s) set.add(s);
  };
  for (const c of customers) add(c.lng, c.lat);
  for (const e of executives) {
    if (e.lastLatitude != null && e.lastLongitude != null) add(e.lastLongitude, e.lastLatitude);
  }
  for (const p of routePoints) add(p.longitude, p.latitude);
  return [...set];
}
