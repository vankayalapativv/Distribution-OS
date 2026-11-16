import { districtOf } from "./district-helpers";
import type { MapCustomer } from "./map-helpers";

/** Group customers by the named region (within `features`) they fall in, dropping
 *  any that land outside every feature. Pure and geometry-agnostic — `features`
 *  may be states (overview tier) OR one state's districts (detail tier); the key
 *  is each feature's `properties.name`. */
export function groupByRegion(
  features: readonly GeoJSON.Feature[],
  customers: MapCustomer[],
): Map<string, MapCustomer[]> {
  const byRegion = new Map<string, MapCustomer[]>();
  for (const c of customers) {
    const r = districtOf(features, c.lng, c.lat);
    if (r) (byRegion.get(r) ?? byRegion.set(r, []).get(r)!).push(c);
  }
  return byRegion;
}

/** Back-compat alias — the district tier is just {@link groupByRegion} over one
 *  state's district polygons. */
export const groupByDistrict = groupByRegion;

/** Heat-fill opacity for a district with `count` customers, scaled by the busiest
 *  district's `maxCount` (√ so mid counts stay visible). Range ≈ 0.18 … 0.60. */
export function heatOpacity(count: number, maxCount: number): number {
  return 0.18 + 0.42 * Math.sqrt(count / maxCount);
}
