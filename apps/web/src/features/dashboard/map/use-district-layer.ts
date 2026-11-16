import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import L from "leaflet";
import { bucketColor, type BandMeta, type MapCustomer } from "./map-helpers";
import { districtAnchors } from "./district-helpers";
import {
  HEAT_COLOR, HEAT_HOVER_BORDER, DISTRICT_LINE, SELECTED_DISTRICT_LINE, DOT_STYLE,
  STATE_LINE, SELECTED_STATE_LINE,
} from "./map-constants";
import { customerDotPopup, districtCountIcon } from "./map-markers";
import { districtHoverTooltip } from "./map-tooltip";
import { groupByRegion, heatOpacity } from "./district-layer-data";

type RegionGroups = ReturnType<typeof groupByRegion>;

/** Draw a customer as a dues-ageing-coloured dot (click → popup). */
function drawDot(group: L.LayerGroup, c: MapCustomer, meta: BandMeta) {
  L.circleMarker([c.lat, c.lng], { ...DOT_STYLE, fillColor: bucketColor(c.bucket) })
    .bindPopup(customerDotPopup(c, meta))
    .addTo(group);
}

/** OVERVIEW tier: only the STATES that contain customers — blue heat fill (by
 *  count) + grey state outline + dues hover-tooltip + count badge. Click a state
 *  zooms into it. States with no customers are left to the basemap. */
function drawStatesOverview(
  group: L.LayerGroup,
  map: L.Map,
  states: readonly GeoJSON.Feature[],
  byState: RegionGroups,
  setSelectedState: Dispatch<SetStateAction<string | null>>,
  meta: BandMeta,
) {
  const maxCount = Math.max(1, ...[...byState.values()].map((l) => l.length));
  for (const f of states) {
    const name = (f.properties?.name as string) ?? "";
    const list = byState.get(name);
    if (!list?.length) continue;
    const base: L.PathOptions = {
      fill: true,
      fillColor: HEAT_COLOR,
      fillOpacity: heatOpacity(list.length, maxCount),
      stroke: true,
      ...STATE_LINE,
    };
    const layer = L.geoJSON(f, { interactive: true, style: base });
    layer.bindTooltip(districtHoverTooltip(name, list, meta), {
      sticky: true, direction: "top", offset: [0, -6], opacity: 1, className: "district-tip",
    });
    layer.on("mouseover", () => layer.setStyle({ stroke: true, color: HEAT_HOVER_BORDER, weight: 3, opacity: 1 }));
    layer.on("mouseout", () => layer.setStyle(base));
    layer.on("click", () => {
      setSelectedState(name);
      map.flyToBounds(layer.getBounds(), { padding: [30, 30], maxZoom: 8, duration: 0.85, easeLinearity: 0.25 });
    });
    layer.addTo(group);
  }
  // Count badge at each state's centre.
  for (const a of districtAnchors(states)) {
    const n = byState.get(a.name)?.length ?? 0;
    if (n === 0) continue;
    L.marker([a.lat, a.lng], { icon: districtCountIcon(a.name, n), interactive: false }).addTo(group);
  }
}

/** STATE-DETAIL tier: the whole selected state — a bold state outline on top of
 *  EVERY district's border (so the full district grid reads); districts WITH
 *  customers get the blue heat fill + hover-tooltip + count badge (click → zoom
 *  into the district); and every in-state customer as a dues-coloured dot. */
function drawStateDetail(
  group: L.LayerGroup,
  map: L.Map,
  stateFeature: GeoJSON.Feature | undefined,
  districts: readonly GeoJSON.Feature[],
  byDistrict: RegionGroups,
  setSelectedDistrict: Dispatch<SetStateAction<string | null>>,
  meta: BandMeta,
) {
  const maxCount = Math.max(1, ...[...byDistrict.values()].map((l) => l.length));
  for (const f of districts) {
    const name = (f.properties?.name as string) ?? "";
    const list = byDistrict.get(name);
    if (!list?.length) {
      // No customers — a clear, non-interactive border so the whole grid reads.
      L.geoJSON(f, { interactive: false, style: { ...DISTRICT_LINE, fill: false } }).addTo(group);
      continue;
    }
    const base: L.PathOptions = {
      fill: true,
      fillColor: HEAT_COLOR,
      fillOpacity: heatOpacity(list.length, maxCount),
      stroke: true,
      ...DISTRICT_LINE,
    };
    const layer = L.geoJSON(f, { interactive: true, style: base });
    layer.bindTooltip(districtHoverTooltip(name, list, meta), {
      sticky: true, direction: "top", offset: [0, -6], opacity: 1, className: "district-tip",
    });
    layer.on("mouseover", () => layer.setStyle({ stroke: true, color: HEAT_HOVER_BORDER, weight: 3, opacity: 1 }));
    layer.on("mouseout", () => layer.setStyle(base));
    layer.on("click", () => {
      setSelectedDistrict(name);
      map.flyToBounds(layer.getBounds(), { padding: [30, 30], maxZoom: 12, duration: 0.85, easeLinearity: 0.25 });
    });
    layer.addTo(group);
  }
  // The state's own border, bold, on top of the district lines so its extent is clear.
  if (stateFeature) {
    L.geoJSON(stateFeature, { interactive: false, style: { ...SELECTED_STATE_LINE, fill: false } }).addTo(group);
  }
  // Count badge per district with customers.
  for (const a of districtAnchors(districts)) {
    const n = byDistrict.get(a.name)?.length ?? 0;
    if (n === 0) continue;
    L.marker([a.lat, a.lng], { icon: districtCountIcon(a.name, n), interactive: false }).addTo(group);
  }
  // Every in-state customer as a dot (click → popup).
  for (const list of byDistrict.values()) for (const c of list) drawDot(group, c, meta);
}

/** DISTRICT-DETAIL tier: the selected district's bold outline + its customers as
 *  dues-coloured dots. */
function drawDistrictDetail(
  group: L.LayerGroup,
  districts: readonly GeoJSON.Feature[],
  byDistrict: RegionGroups,
  selectedDistrict: string,
  meta: BandMeta,
) {
  const feature = districts.find((f) => (f.properties?.name as string) === selectedDistrict);
  if (feature) {
    L.geoJSON(feature, { interactive: false, style: { ...SELECTED_DISTRICT_LINE, fill: false } }).addTo(group);
  }
  for (const c of byDistrict.get(selectedDistrict) ?? []) drawDot(group, c, meta);
}

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
      // Within the selected state: group customers by its districts.
      const byDistrict = groupByRegion(districts, customers);
      if (selectedDistrict) {
        drawDistrictDetail(group, districts, byDistrict, selectedDistrict, meta);
      } else {
        const stateFeature = states.find((f) => (f.properties?.name as string) === selectedState);
        drawStateDetail(group, map, stateFeature, districts, byDistrict, setSelectedDistrict, meta);
      }
    }

    group.addTo(map);
    groupRef.current = group;
  }, [mapRef, customers, states, districts, selectedState, selectedDistrict, setSelectedState, setSelectedDistrict, meta]);
}
