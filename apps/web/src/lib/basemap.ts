import { vectorBasemapStyle } from "vardhan-maps/react";
import type * as LType from "leaflet";
import { guardMaplibreLeaflet } from "@/lib/maplibre-leaflet-guard";

// Self-hosted OpenStreetMap VECTOR basemap (built from current OSM data, hosted on
// our Cloudflare R2). Light-grey minimal, place + road labels, NO POI icons.
// vardhan-maps ships our R2 tiles as its default, so `vectorBasemapStyle()` needs
// no config here — the `<IndiaMap vector />` component uses the same default.

let vectorLibs: Promise<void> | null = null;

/**
 * Add our self-hosted vector basemap to an EXISTING Leaflet map (for the custom
 * dashboard Customers map, which isn't a vardhan-maps component). Registers the
 * pmtiles protocol once and drops a MapLibre GL canvas under the Leaflet overlays.
 * Returns the layer (already added). The vardhan-maps `<IndiaMap vector />` does
 * this internally, so the Live Tracking map doesn't need it.
 */
export async function addVectorBasemap(L: typeof LType, map: LType.Map): Promise<LType.Layer | null> {
  try {
    if (!vectorLibs) {
      vectorLibs = (async () => {
        const glMod = await import("maplibre-gl");
        const maplibregl = ((glMod as { default?: unknown }).default ?? glMod) as {
          addProtocol: (n: string, h: unknown) => void;
          setWorkerUrl?: (url: string) => void;
        };
        (globalThis as { maplibregl?: unknown }).maplibregl = maplibregl; // the leaflet plugin reads the global
        // maplibre-gl v6 loads its render worker as an ESM module chunk the bundler
        // emits; OpenNext/Cloudflare doesn't serve that chunk, so point it at the
        // self-hosted worker (public/maplibre-gl-worker.mjs) instead. No-op on v4.
        maplibregl.setWorkerUrl?.("/maplibre-gl-worker.mjs");
        const pm = (await import("pmtiles")) as { Protocol: new () => { tile: unknown } };
        // Runs once (guarded by the module-scoped `vectorLibs` promise).
        maplibregl.addProtocol("pmtiles", new pm.Protocol().tile);
        await import("@maplibre/maplibre-gl-leaflet");
      })();
    }
    await vectorLibs;
    // Null-guard the plugin against the map-teardown race (getZoom on a removed
    // map). Idempotent + shared prototype, so this also covers the tracking map.
    guardMaplibreLeaflet(L);
    const layer = (L as unknown as { maplibreGL: (o: Record<string, unknown>) => LType.Layer }).maplibreGL({
      style: vectorBasemapStyle(), // vardhan-maps' default self-hosted TG+AP tiles
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    });
    layer.addTo(map);
    return layer;
  } catch (err) {
    if (typeof console !== "undefined") console.error("[basemap] vector basemap failed:", err);
    return null;
  }
}
