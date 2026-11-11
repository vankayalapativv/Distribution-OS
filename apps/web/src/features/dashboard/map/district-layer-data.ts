import { districtOf } from "./district-helpers";
import type { MapCustomer } from "./map-helpers";

/** Group customers by the district (within `features`) they fall in, dropping any
 *  that land outside every district. Pure. */
export function groupByDistrict(
  features: readonly GeoJSON.Feature[],
  customers: MapCustomer[],
): Map<string, MapCustomer[]> {
  const byDistrict = new Map<string, MapCustomer[]>();
  for (const c of customers) {
    const d = districtOf(features, c.lng, c.lat);
    if (d) (byDistrict.get(d) ?? byDistrict.set(d, []).get(d)!).push(c);
  }
  return byDistrict;
}

/** Heat-fill opacity for a district with `count` customers, scaled by the busiest
 *  district's `maxCount` (√ so mid counts stay visible). Range ≈ 0.18 … 0.60. */
export function heatOpacity(count: number, maxCount: number): number {
  return 0.18 + 0.42 * Math.sqrt(count / maxCount);
}
