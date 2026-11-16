import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { indiaOutline } from "vardhan-maps/data";
import { addVectorBasemap } from "@/lib/basemap";
import { INDIA_BOUNDS, INDIA_MIN_ZOOM } from "./map-constants";

/** Bounds of the whole of India — the map's outer framing and soft pan limit.
 *  The dashboard Customers Map opens fit to the states that actually have
 *  customers (see use-osm-map-init), not to this; this is only the fallback frame
 *  and the generous box the view is kept within. */
export function indiaBounds(): L.LatLngBounds {
  return L.latLngBounds(INDIA_BOUNDS);
}

/**
 * Creates the India-wide Leaflet map in `container`: the self-hosted OSM vector
 * basemap plus a faint national outline for context. The map pans FREELY across
 * India — a soft `maxBounds` (low viscosity) stops it drifting out to the open
 * ocean / whole world, but there is no hard regional lock, so customers in any
 * state are reachable. Calls `onReady` once the basemap has finished painting (or
 * immediately if it can't). Pure Leaflet imperative wiring.
 */
export function createRegionMap(container: HTMLElement, onReady: () => void): L.Map {
  const bounds = indiaBounds();
  // Give the map an explicit initial view BEFORE fitting — creating it view-less
  // and relying only on fitBounds leaves the MapLibre GL canvas stale after a
  // client-side remount (it paints blank until the next interaction).
  const map = L.map(container, {
    center: bounds.getCenter(),
    zoom: INDIA_MIN_ZOOM,
    minZoom: INDIA_MIN_ZOOM,
    maxBounds: bounds.pad(0.35), // soft outer limit — free pan within India, no world drift
    maxBoundsViscosity: 0.4, // gentle (not a hard lock) so border states pan smoothly
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

  // A faint national outline for context. No opaque clip mask: the operating area
  // is derived from the data and can span several states, so there is no single
  // region to punch out.
  L.geoJSON(indiaOutline as unknown as GeoJSON.GeoJsonObject, {
    interactive: false,
    style: { color: "#94a3b8", weight: 1, fill: false, opacity: 0.5 },
  }).addTo(map);

  return map;
}
