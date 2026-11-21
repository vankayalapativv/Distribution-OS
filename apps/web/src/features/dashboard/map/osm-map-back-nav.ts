import L from "leaflet";
import { indiaBounds } from "./create-region-map";
import { isClickOutsideSelection } from "./osm-map-geometry";
import type { OsmMapInitOptions } from "./osm-map-init-options";

const FLY = { duration: 0.85, easeLinearity: 0.25 } as const;

/**
 * A background click steps back ONE tier (same framing as drilling in, reversed):
 * in a district → fly back to its state; in a state → fly back to the states
 * overview. A click INSIDE the current selection is ignored. Pure given `map` +
 * the live `opts` snapshot, so it unit-tests without a real Leaflet map.
 */
export function stepBackOnClick(map: L.Map, opts: OsmMapInitOptions, lng: number, lat: number): void {
  if (opts.selectedDistrict) {
    if (!isClickOutsideSelection(opts.districts, opts.selectedDistrict, lng, lat)) return;
    opts.setSelectedDistrict(null);
    const sf = opts.states.find((f) => (f.properties?.name as string) === opts.selectedState);
    if (sf) {
      map.flyToBounds(L.geoJSON(sf).getBounds(), { padding: [30, 30], maxZoom: 8, ...FLY });
    }
    return;
  }
  if (opts.selectedState) {
    if (!isClickOutsideSelection(opts.states, opts.selectedState, lng, lat)) return;
    opts.setSelectedState(null);
    opts.setSelectedDistrict(null);
    map.flyToBounds(opts.overviewBounds ?? indiaBounds(), { padding: [20, 20], ...FLY });
  }
}
