import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import L from "leaflet";
import { bucketColor, type MapCustomer } from "./map-helpers";
import { districtAnchors } from "./district-helpers";
import {
  HEAT_COLOR, HEAT_HOVER_BORDER, DISTRICT_LINE, SELECTED_DISTRICT_LINE, DOT_STYLE,
} from "./map-constants";
import { customerDotPopup, districtCountIcon } from "./map-markers";
import { districtHoverTooltip } from "./map-tooltip";
import { groupByDistrict, heatOpacity } from "./district-layer-data";

type DistrictGroups = ReturnType<typeof groupByDistrict>;

/** DETAIL view: the selected district's bold outline + its customers as
 *  dues-coloured dots. */
function drawSelectedDistrict(
  group: L.LayerGroup,
  districts: readonly GeoJSON.Feature[],
  byDistrict: DistrictGroups,
  selected: string,
) {
  const feature = districts.find((f) => (f.properties?.name as string) === selected);
  if (feature) {
    L.geoJSON(feature, {
      interactive: false,
      style: { ...SELECTED_DISTRICT_LINE, fill: false },
    }).addTo(group);
  }
  for (const c of byDistrict.get(selected) ?? []) {
    // Fill by dues-ageing bucket (slate for no-dues) — matches the Dues card.
    L.circleMarker([c.lat, c.lng], { ...DOT_STYLE, fillColor: bucketColor(c.bucket) })
      .bindPopup(customerDotPopup(c))
      .addTo(group);
  }
}

/** OVERVIEW view: only districts that contain customers (heat fill + outline +
 *  hover tooltip + count badge), each customer as a dot; click a district zooms in. */
function drawOverview(
  group: L.LayerGroup,
  map: L.Map,
  districts: readonly GeoJSON.Feature[],
  byDistrict: DistrictGroups,
  setSelected: Dispatch<SetStateAction<string | null>>,
) {
  const maxCount = Math.max(1, ...[...byDistrict.values()].map((l) => l.length));
  // Only districts that actually have customers are drawn (border + blue heat
  // fill + count badge). Everything else on the map is left to the basemap.
  for (const f of districts) {
    const name = (f.properties?.name as string) ?? "";
    const list = byDistrict.get(name);
    if (!list?.length) continue;
    const n = list.length;
    const base: L.PathOptions = {
      fill: true,
      fillColor: HEAT_COLOR,
      fillOpacity: heatOpacity(n, maxCount),
      stroke: true,
      ...DISTRICT_LINE, // light-grey outline under the heat fill
    };
    const layer = L.geoJSON(f, { interactive: true, style: base });
    layer.bindTooltip(districtHoverTooltip(name, list), {
      sticky: true,
      direction: "top",
      offset: [0, -6],
      opacity: 1,
      className: "district-tip",
    });
    layer.on("mouseover", () => layer.setStyle({ stroke: true, color: HEAT_HOVER_BORDER, weight: 3, opacity: 1 }));
    layer.on("mouseout", () => layer.setStyle(base));
    layer.on("click", () => {
      setSelected(name);
      // Smooth animated zoom into the district (not an instant snap).
      map.flyToBounds(layer.getBounds(), {
        padding: [30, 30], maxZoom: 12, duration: 0.85, easeLinearity: 0.25,
      });
    });
    layer.addTo(group);
  }
  for (const a of districtAnchors(districts)) {
    const n = byDistrict.get(a.name)?.length ?? 0;
    if (n === 0) continue;
    L.marker([a.lat, a.lng], { icon: districtCountIcon(a.name, n), interactive: false }).addTo(group);
  }

  // Each in-district customer as an individual dot on top of the heat map,
  // coloured by dues bucket (click → popup). Pins outside every district are
  // dropped by groupByDistrict, so they never appear.
  for (const list of byDistrict.values()) {
    for (const c of list) {
      L.circleMarker([c.lat, c.lng], { ...DOT_STYLE, fillColor: bucketColor(c.bucket) })
        .bindPopup(customerDotPopup(c))
        .addTo(group);
    }
  }
}

/** Draws the per-district layer over `districts` (all of Telangana, from
 *  vardhan-maps), rebuilt on customer/district/selection change:
 *   • OVERVIEW (selected null): ONLY districts that contain customers get drawn —
 *     each shaded by count (heat map) + grey outline + hover-tooltip + count badge
 *     + its customers as dots; click a district zooms in. Districts with no
 *     customers, and pins outside every district, are not drawn.
 *   • DETAIL (a name): the district's bold outline + its customers as dots
 *     coloured by dues-ageing bucket (click a dot → customer popup). */
export function useDistrictLayer(
  mapRef: RefObject<L.Map | null>,
  customers: MapCustomer[],
  districts: readonly GeoJSON.Feature[],
  selected: string | null,
  setSelected: Dispatch<SetStateAction<string | null>>,
) {
  const groupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    groupRef.current?.remove();

    const byDistrict = groupByDistrict(districts, customers);
    const group = L.layerGroup();

    if (selected) drawSelectedDistrict(group, districts, byDistrict, selected);
    else drawOverview(group, map, districts, byDistrict, setSelected);

    group.addTo(map);
    groupRef.current = group;
  }, [mapRef, customers, districts, selected, setSelected]);
}
