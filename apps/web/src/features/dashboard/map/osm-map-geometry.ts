import { districtOf } from "./district-helpers";

/** True when a map click at [lng,lat] falls OUTSIDE the currently-selected region
 *  (a state in the overview-detail step, or a district in the district-detail
 *  step) within `features`, so the view should step back out one tier. A click
 *  with nothing selected, or inside the selection, is a no-op. Geometry-agnostic:
 *  pass whichever feature set the current tier selects within. */
export function isClickOutsideSelection(
  features: readonly GeoJSON.Feature[],
  selected: string | null,
  lng: number,
  lat: number,
): boolean {
  return selected != null && districtOf(features, lng, lat) !== selected;
}
