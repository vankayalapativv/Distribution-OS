"use client";

import { useRef, useState } from "react";
import { Maximize2 } from "lucide-react";
import { type MapCustomer } from "./map-helpers";
import { useOsmMapInit } from "./use-osm-map-init";
import { useDistrictLayer } from "./use-district-layer";
import { useFitButton } from "./use-fit-button";
import { useTelanganaDistricts } from "./use-telangana-districts";

/** OpenStreetMap of the customer base: per-district heat overview (hover for a
 *  dues tooltip, click to zoom into a district's ageing-coloured customer dots).
 *  Map creation, the district layer, and the Fit button live in dedicated hooks. */
export function OsmMap({
  customers,
  onRenderComplete,
}: {
  readonly customers: MapCustomer[];
  /** Fires once the basemap is fully rendered (all tiles painted). */
  readonly onRenderComplete?: () => void;
}) {
  // null = overview (badges + hover); a name = zoomed into that district (dots).
  const [selected, setSelected] = useState<string | null>(null);
  const divRef = useRef<HTMLDivElement | null>(null);

  // All Telangana districts, loaded lazily from vardhan-maps (empty until ready);
  // the heat overlay follows wherever customers actually are.
  const districts = useTelanganaDistricts();

  const mapRef = useOsmMapInit(divRef, selected, setSelected, districts, onRenderComplete);
  useDistrictLayer(mapRef, customers, districts, selected, setSelected);
  const fitToPins = useFitButton(mapRef, customers, districts);

  return (
    <div className="relative h-full w-full">
      <div ref={divRef} className="h-full w-full" />
      {/* CSS content cross-fade: a faint veil that replays each time the
          selected district changes, smoothing the layer swap while the map
          animates its zoom (fly-to). Keyed so it re-mounts on every change,
          replaying the `map-veil` keyframe (globals.css); pointer-events-none so
          it never blocks interaction; z below the Fit button but above the
          Leaflet content panes. */}
      <div
        key={selected ?? "overview"}
        aria-hidden
        className="map-veil pointer-events-none absolute inset-0 z-[650] bg-white"
      />
      <button
        type="button"
        onClick={fitToPins}
        title="Frame all pins"
        className="absolute right-2 top-2 z-[700] flex items-center gap-1 rounded-md border border-border bg-white px-2 py-1 text-xs font-medium text-foreground shadow-sm hover:bg-accent"
      >
        <Maximize2 size={12} /> Fit
      </button>
    </div>
  );
}
