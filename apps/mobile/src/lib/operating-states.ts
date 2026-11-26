import { getStates } from "vardhan-maps/data";

/**
 * Which Indian states the day's tracking data actually touches — so the map can
 * draw boundaries + districts ONLY where you operate (any state, no hard-coded
 * region) and auto-frame there. Geometric: ray-casting point-in-polygon of each
 * coordinate against the bundled low-res state boundaries from `vardhan-maps`.
 *
 * Mirrors the web's `operatingStatesOf` (apps/web/.../tracking/tracking-region.ts
 * + district-helpers.ts); kept as a small local copy because the web helpers live
 * behind the web `@/` alias. A future `packages/shared` is the home for one copy.
 */

type Ring = number[][];
type GeoFeature = {
  geometry: { type: string; coordinates: unknown };
  properties?: { name?: string } | null;
};

/** Ray-casting: is [x=lng, y=lat] inside this ring? */
function inRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Inside the outer ring but outside every hole. */
function inPolygon(x: number, y: number, rings: Ring[]): boolean {
  if (!rings.length || !inRing(x, y, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) if (inRing(x, y, rings[i])) return false;
  return true;
}

function polygonsOf(geometry: GeoFeature["geometry"]): Ring[][] {
  if (geometry.type === "Polygon") return [geometry.coordinates as Ring[]];
  if (geometry.type === "MultiPolygon") return geometry.coordinates as Ring[][];
  return [];
}

/** The name of the state containing [lng, lat], or null when outside every state. */
function stateOf(features: readonly GeoFeature[], lng: number, lat: number): string | null {
  for (const f of features) {
    for (const poly of polygonsOf(f.geometry)) {
      if (inPolygon(lng, lat, poly)) return f.properties?.name ?? null;
    }
  }
  return null;
}

// All 36 state / UT boundaries (bundled low-res), computed once at module load.
const STATE_FEATURES = getStates() as unknown as GeoFeature[];

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * The set of state names the given points fall in (deduped). An empty array when
 * there are no points or none land inside India — the caller then shows the
 * all-India outline with no district detail.
 */
export function operatingStatesOf(points: readonly LatLng[]): string[] {
  const set = new Set<string>();
  for (const p of points) {
    if (!Number.isFinite(p.lng) || !Number.isFinite(p.lat)) continue;
    const s = stateOf(STATE_FEATURES, p.lng, p.lat);
    if (s) set.add(s);
  }
  return [...set];
}
