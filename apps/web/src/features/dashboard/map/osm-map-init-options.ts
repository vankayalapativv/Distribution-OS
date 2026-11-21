import type { Dispatch, SetStateAction } from "react";
import type L from "leaflet";

/** What the map-init needs to drive two-tier back-navigation + framing. */
export interface OsmMapInitOptions {
  selectedState: string | null;
  selectedDistrict: string | null;
  setSelectedState: Dispatch<SetStateAction<string | null>>;
  setSelectedDistrict: Dispatch<SetStateAction<string | null>>;
  /** All Indian states (for the state-detail → overview step-out check). */
  states: readonly GeoJSON.Feature[];
  /** The selected state's districts (for the district-detail → state step-out). */
  districts: readonly GeoJSON.Feature[];
  /** Bounds of the states that have customers — the initial frame + the target
   *  when stepping back out to the overview. Null until customers/states load. */
  overviewBounds: L.LatLngBounds | null;
}
