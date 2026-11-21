import L from "leaflet";
import { bucketColor, type BandMeta, type MapCustomer } from "./map-helpers";
import { districtAnchors } from "./district-helpers";
import { HEAT_COLOR, HEAT_HOVER_BORDER, DOT_STYLE } from "./map-constants";
import { customerDotPopup, districtCountIcon } from "./map-markers";
import { districtHoverTooltip } from "./map-tooltip";
import { heatOpacity, type RegionGroups } from "./district-layer-data";

/** Draw a customer as a dues-ageing-coloured dot (click → popup). */
export function drawDot(group: L.LayerGroup, c: MapCustomer, meta: BandMeta) {
  L.circleMarker([c.lat, c.lng], { ...DOT_STYLE, fillColor: bucketColor(c.bucket) })
    .bindPopup(customerDotPopup(c, meta))
    .addTo(group);
}

/** A blue heat region (state or district) with a dues hover-tooltip, hover border
 *  and a click handler (receives the layer, for framing). `onClick` differs per
 *  tier (which selection to set + how far to zoom). */
export function drawHeatRegion(
  group: L.LayerGroup,
  f: GeoJSON.Feature,
  name: string,
  list: MapCustomer[],
  maxCount: number,
  lineStyle: L.PathOptions,
  meta: BandMeta,
  onClick: (layer: L.GeoJSON) => void,
) {
  const base: L.PathOptions = { fill: true, fillColor: HEAT_COLOR, fillOpacity: heatOpacity(list.length, maxCount), stroke: true, ...lineStyle };
  const layer = L.geoJSON(f, { interactive: true, style: base });
  layer.bindTooltip(districtHoverTooltip(name, list, meta), {
    sticky: true, direction: "top", offset: [0, -6], opacity: 1, className: "district-tip",
  });
  layer.on("mouseover", () => layer.setStyle({ stroke: true, color: HEAT_HOVER_BORDER, weight: 3, opacity: 1 }));
  layer.on("mouseout", () => layer.setStyle(base));
  layer.on("click", () => onClick(layer));
  layer.addTo(group);
}

/** A count badge at the centre of every region that has customers. */
export function drawCountBadges(group: L.LayerGroup, features: readonly GeoJSON.Feature[], byRegion: RegionGroups) {
  for (const a of districtAnchors(features)) {
    const n = byRegion.get(a.name)?.length ?? 0;
    if (n === 0) continue;
    L.marker([a.lat, a.lng], { icon: districtCountIcon(a.name, n), interactive: false }).addTo(group);
  }
}
