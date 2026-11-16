"use client";

import { useMemo, useRef, useState } from "react";
import L from "leaflet";
import { Maximize2 } from "lucide-react";
import { bandMeta, type DuesBand, type MapCustomer } from "./map-helpers";
import { useOsmMapInit } from "./use-osm-map-init";
import { useMapLayer } from "./use-district-layer";
import { useFitButton } from "./use-fit-button";
import { useAllStates, useStateDistricts } from "./use-map-geodata";
import { groupByRegion } from "./district-layer-data";

/** OpenStreetMap of the customer base, derived entirely from the data (no
 *  hardcoded region): a 3-tier drill-down — STATES that have customers (heat +
 *  counts) → one state's DISTRICTS (borders + heat + dots) → a district's
 *  customer dots. Map creation, the tier layer, and the Fit button live in
 *  dedicated hooks. */
export function OsmMap({
  customers,
  bands,
  onRenderComplete,
}: {
  readonly customers: MapCustomer[];
  /** The enterprise's dues bands — drive the dot popups + district ageing table. */
  readonly bands?: DuesBand[];
  /** Fires once the basemap is fully rendered (all tiles painted). */
  readonly onRenderComplete?: () => void;
}) {
  // null/null = states overview; a state = zoomed into its districts; a state +
  // district = zoomed into that district's customer dots.
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const divRef = useRef<HTMLDivElement | null>(null);
  const meta = useMemo(() => bandMeta(bands), [bands]);

  // All Indian states (bundled) + the selected state's districts (lazy). The heat
  // follows wherever customers actually are.
  const states = useAllStates();
  const districts = useStateDistricts(selectedState);

  // Bounds of the states that actually contain customers — the initial frame and
  // the fly-back target for the overview.
  const overviewBounds = useMemo(() => {
    if (!states.length || !customers.length) return null;
    const byState = groupByRegion(states, customers);
    const withCustomers = states.filter(
      (f) => (byState.get((f.properties?.name as string) ?? "")?.length ?? 0) > 0,
    );
    if (!withCustomers.length) return null;
    return L.geoJSON({ type: "FeatureCollection", features: withCustomers } as GeoJSON.FeatureCollection).getBounds();
  }, [states, customers]);

  const initOpts = useMemo(
    () => ({ selectedState, selectedDistrict, setSelectedState, setSelectedDistrict, states, districts, overviewBounds }),
    [selectedState, selectedDistrict, states, districts, overviewBounds],
  );

  const mapRef = useOsmMapInit(divRef, initOpts, onRenderComplete);
  useMapLayer(mapRef, customers, states, districts, selectedState, selectedDistrict, setSelectedState, setSelectedDistrict, meta);
  const fitToPins = useFitButton(mapRef, customers);

  return (
    <div className="relative h-full w-full">
      <div ref={divRef} className="h-full w-full" />
      {/* CSS content cross-fade: a faint veil that replays on every tier change,
          smoothing the layer swap while the map animates its zoom (fly-to). Keyed
          so it re-mounts on each change, replaying the `map-veil` keyframe
          (globals.css); pointer-events-none so it never blocks interaction. */}
      <div
        key={`${selectedState ?? "overview"}/${selectedDistrict ?? ""}`}
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
