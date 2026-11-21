import { type Dispatch, type SetStateAction } from "react";
import L from "leaflet";
import type { BandMeta } from "./map-helpers";
import { DISTRICT_LINE, STATE_LINE, SELECTED_DISTRICT_LINE, SELECTED_STATE_LINE } from "./map-constants";
import type { RegionGroups } from "./district-layer-data";
import { drawDot, drawHeatRegion, drawCountBadges } from "./district-layer-parts";

const FLY = { padding: [30, 30] as [number, number], duration: 0.85, easeLinearity: 0.25 };
const regionName = (f: GeoJSON.Feature) => (f.properties?.name as string) ?? "";
const maxOf = (g: RegionGroups) => Math.max(1, ...[...g.values()].map((l) => l.length));

/** OVERVIEW: only the STATES that contain customers — blue heat + count badges.
 *  Click a state zooms into it. States with no customers are left to the basemap. */
export function drawStatesOverview(
  group: L.LayerGroup, map: L.Map, states: readonly GeoJSON.Feature[],
  byState: RegionGroups, setSelectedState: Dispatch<SetStateAction<string | null>>, meta: BandMeta,
) {
  const maxCount = maxOf(byState);
  for (const f of states) {
    const name = regionName(f);
    const list = byState.get(name);
    if (!list?.length) continue;
    drawHeatRegion(group, f, name, list, maxCount, STATE_LINE, meta, (layer) => {
      setSelectedState(name);
      map.flyToBounds(layer.getBounds(), { ...FLY, maxZoom: 8 });
    });
  }
  drawCountBadges(group, states, byState);
}

/** STATE DETAIL: every district's border (full grid); districts WITH customers get
 *  heat + badges + dots (click → zoom in); the state's own border sits bold on top. */
export function drawStateDetail(
  group: L.LayerGroup, map: L.Map, stateFeature: GeoJSON.Feature | undefined,
  districts: readonly GeoJSON.Feature[], byDistrict: RegionGroups,
  setSelectedDistrict: Dispatch<SetStateAction<string | null>>, meta: BandMeta,
) {
  const maxCount = maxOf(byDistrict);
  for (const f of districts) {
    const name = regionName(f);
    const list = byDistrict.get(name);
    if (!list?.length) {
      L.geoJSON(f, { interactive: false, style: { ...DISTRICT_LINE, fill: false } }).addTo(group);
      continue;
    }
    drawHeatRegion(group, f, name, list, maxCount, DISTRICT_LINE, meta, (layer) => {
      setSelectedDistrict(name);
      map.flyToBounds(layer.getBounds(), { ...FLY, maxZoom: 12 });
    });
  }
  if (stateFeature) L.geoJSON(stateFeature, { interactive: false, style: { ...SELECTED_STATE_LINE, fill: false } }).addTo(group);
  drawCountBadges(group, districts, byDistrict);
  for (const list of byDistrict.values()) for (const c of list) drawDot(group, c, meta);
}

/** DISTRICT DETAIL: the selected district's bold outline + its customer dots. */
export function drawDistrictDetail(
  group: L.LayerGroup, districts: readonly GeoJSON.Feature[], byDistrict: RegionGroups,
  selectedDistrict: string, meta: BandMeta,
) {
  const feature = districts.find((f) => regionName(f) === selectedDistrict);
  if (feature) L.geoJSON(feature, { interactive: false, style: { ...SELECTED_DISTRICT_LINE, fill: false } }).addTo(group);
  for (const c of byDistrict.get(selectedDistrict) ?? []) drawDot(group, c, meta);
}
