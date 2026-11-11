import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { addVectorBasemap } from "@/lib/basemap";
import { TELANGANA_BOUNDARY } from "./telangana-boundary";
import { REGION_MIN_ZOOM, REGION_BOUNDS } from "./map-constants";
import { buildRegionMask } from "./osm-map-geometry";

/** Bounds of the whole Telangana state (from its boundary polygon). The map opens
 *  framed to this — the entire state, centered — regardless of where the pins are. */
export function telanganaBounds(): L.LatLngBounds {
  return L.geoJSON(TELANGANA_BOUNDARY as GeoJSON.GeometryObject).getBounds();
}

/**
 * Creates the region-locked Leaflet map in `container`: the self-hosted OSM
 * vector basemap, the opaque Telangana clip mask, and the bold state outline. Calls
 * `onReady` once the basemap has finished painting (or immediately if it can't).
 * Pure Leaflet imperative wiring — smoke-tested via the OsmMap render, not units.
 */
export function createRegionMap(container: HTMLElement, onReady: () => void): L.Map {
  const bounds = telanganaBounds();
  // Give the map an explicit initial view (centre of the state) BEFORE fitting —
  // creating it view-less and relying only on fitBounds leaves the MapLibre GL
  // canvas stale after a client-side remount (it paints blank until the next
  // interaction). fitBounds then frames the entire state, centered (not the pins).
  const map = L.map(container, {
    center: bounds.getCenter(),
    zoom: REGION_MIN_ZOOM,
    minZoom: REGION_MIN_ZOOM,
    maxBounds: L.latLngBounds(REGION_BOUNDS),
    maxBoundsViscosity: 1.0, // hard lock — cannot pan outside the region
  });
  map.fitBounds(bounds, { padding: [10, 10] });
  map.attributionControl.setPrefix(false);

  void addVectorBasemap(L, map).then((layer) => {
    const glMap = layer
      ? (layer as unknown as { getMaplibreMap?: () => { once: (ev: string, cb: () => void) => void } }).getMaplibreMap?.()
      : null;
    if (glMap) glMap.once("idle", onReady);
    else onReady();
  });

  L.geoJSON(buildRegionMask(), {
    interactive: false,
    style: { stroke: false, weight: 0, fillColor: "#e8e8e6", fillOpacity: 1 },
  }).addTo(map);

  L.geoJSON(TELANGANA_BOUNDARY as GeoJSON.GeometryObject, {
    interactive: false,
    style: { color: "#475569", weight: 2, fill: false, opacity: 0.9 },
  }).addTo(map);

  return map;
}
