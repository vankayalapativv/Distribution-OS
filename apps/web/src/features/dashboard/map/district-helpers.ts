// Point-in-polygon (which district a customer falls in) + per-district label
// anchors, over a set of district polygons the caller supplies (the dashboard
// map loads all of Telangana from vardhan-maps; tracking passes its own set).

type Ring = number[][];

/** Ray-casting: is [x=lng, y=lat] inside this ring? */
export function inRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Inside the outer ring but outside every hole. */
export function inPolygon(x: number, y: number, rings: Ring[]): boolean {
  if (!rings.length || !inRing(x, y, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) if (inRing(x, y, rings[i])) return false;
  return true;
}

export function polygonsOf(geometry: GeoJSON.Geometry): Ring[][] {
  if (geometry.type === "Polygon") return [geometry.coordinates as Ring[]];
  if (geometry.type === "MultiPolygon") return geometry.coordinates as Ring[][];
  return [];
}

/** A feature's district name, or null when absent. */
export function featureName(f: GeoJSON.Feature): string | null {
  return (f.properties?.name as string) ?? null;
}

/** The name of the district in `features` containing [lng, lat], or null if the
 *  point falls outside every district. */
export function districtOf(
  features: readonly GeoJSON.Feature[],
  lng: number,
  lat: number,
): string | null {
  for (const f of features) {
    for (const poly of polygonsOf(f.geometry)) {
      if (inPolygon(lng, lat, poly)) return featureName(f);
    }
  }
  return null;
}

/** A label anchor per district — the vertex-average of its largest polygon's
 *  outer ring (good enough to place a small count badge inside the district). */
export interface DistrictAnchor {
  name: string;
  lat: number;
  lng: number;
}

/** The badge anchor for one district feature: the average vertex of its largest
 *  polygon's outer ring, or (0,0) when it has no usable geometry. Pure. */
export function anchorOf(f: GeoJSON.Feature): DistrictAnchor {
  let best: Ring | null = null;
  for (const poly of polygonsOf(f.geometry)) {
    const outer = poly[0];
    if (outer && (!best || outer.length > best.length)) best = outer;
  }
  let lng = 0, lat = 0;
  if (best) {
    for (const [x, y] of best) { lng += x; lat += y; }
    lng /= best.length;
    lat /= best.length;
  }
  return { name: featureName(f) ?? "", lat, lng };
}

// Cache the anchors per district-feature array (keyed by the array identity, so
// the stable vardhan-maps collection is computed once).
const anchorCache = new WeakMap<readonly GeoJSON.Feature[], DistrictAnchor[]>();

export function districtAnchors(features: readonly GeoJSON.Feature[]): DistrictAnchor[] {
  let cached = anchorCache.get(features);
  if (!cached) {
    cached = features.map(anchorOf);
    anchorCache.set(features, cached);
  }
  return cached;
}
