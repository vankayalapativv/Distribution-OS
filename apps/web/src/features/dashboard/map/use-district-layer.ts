import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import L from "leaflet";
import type { BandMeta, MapCustomer } from "./map-helpers";
import { groupByRegion } from "./district-layer-data";
import { drawStatesOverview, drawStateDetail, drawDistrictDetail } from "./district-layer-tiers";

const regionName = (f: GeoJSON.Feature) => (f.properties?.name as string) ?? "";

/** Draws the active map tier, rebuilt on any data/selection change:
 *   • OVERVIEW (no state selected): states that contain customers, as a heat map
 *     + count badges; click a state zooms in.
 *   • STATE DETAIL (a state, no district): that state's districts — faint context
 *     borders everywhere, heat + badges + dots where customers are; click a
 *     district zooms in.
 *   • DISTRICT DETAIL (state + district): the district outline + customer dots.
 *
 *  `states` are all Indian states (for the overview + geometric state grouping);
 *  `districts` are the SELECTED state's districts (empty until one is picked). */
export function useMapLayer(
  mapRef: RefObject<L.Map | null>,
  customers: MapCustomer[],
  states: readonly GeoJSON.Feature[],
  districts: readonly GeoJSON.Feature[],
  selectedState: string | null,
  selectedDistrict: string | null,
  setSelectedState: Dispatch<SetStateAction<string | null>>,
  setSelectedDistrict: Dispatch<SetStateAction<string | null>>,
  meta: BandMeta,
) {
  const groupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    groupRef.current?.remove();
    const group = L.layerGroup();

    if (!selectedState) {
      drawStatesOverview(group, map, states, groupByRegion(states, customers), setSelectedState, meta);
    } else {
      const byDistrict = groupByRegion(districts, customers);
      if (selectedDistrict) {
        drawDistrictDetail(group, districts, byDistrict, selectedDistrict, meta);
      } else {
        const stateFeature = states.find((f) => regionName(f) === selectedState);
        drawStateDetail(group, map, stateFeature, districts, byDistrict, setSelectedDistrict, meta);
      }
    }

    group.addTo(map);
    groupRef.current = group;
  }, [mapRef, customers, states, districts, selectedState, selectedDistrict, setSelectedState, setSelectedDistrict, meta]);
}
