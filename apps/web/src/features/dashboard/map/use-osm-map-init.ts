import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import L from "leaflet";
import { ensureTooltipStyles } from "./map-tooltip";
import { createRegionMap, indiaBounds } from "./create-region-map";
import { isClickOutsideSelection } from "./osm-map-geometry";

/** What the map-init needs to drive two-tier back-navigation + framing. */
export interface OsmMapInitOptions {
  selectedState: string | null;
  selectedDistrict: string | null;
  setSelectedState: Dispatch<SetStateAction<string | null>>;
  setSelectedDistrict: Dispatch<SetStateAction<string | null>>;
  /** All Indian states (for the state-detail → overview step-out check). */
  states: readonly GeoJSON.Feature[];
  /** The selected state's districts (for the district-detail → state step-out). */
  districts: readonly GeoJSON.Feature[];
  /** Bounds of the states that have customers — the initial frame + the target
   *  when stepping back out to the overview. Null until customers/states load. */
  overviewBounds: L.LatLngBounds | null;
}

/** Creates the Leaflet map once (via {@link createRegionMap}), frames it to the
 *  states that actually have customers on first load, and wires background clicks
 *  to step OUT one tier at a time (district → state → overview), flying back to
 *  the matching frame. Survives React StrictMode's dev double-mount (deferred
 *  teardown). Returns the map ref. */
export function useOsmMapInit(
  divRef: RefObject<HTMLDivElement | null>,
  opts: OsmMapInitOptions,
  onRenderComplete?: () => void,
): RefObject<L.Map | null> {
  const mapRef = useRef<L.Map | null>(null);
  const hasFittedRef = useRef(false);
  const roRef = useRef<ResizeObserver | null>(null);
  const destroyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live snapshots of everything the imperative click handler reads.
  const optsRef = useRef(opts);
  useEffect(() => { optsRef.current = opts; }, [opts]);
  const onReadyRef = useRef(onRenderComplete);
  useEffect(() => { onReadyRef.current = onRenderComplete; }, [onRenderComplete]);

  useEffect(() => {
    const container = divRef.current;
    if (!container) return;
    ensureTooltipStyles();
    if (destroyTimerRef.current) {
      clearTimeout(destroyTimerRef.current);
      destroyTimerRef.current = null;
    }

    if (!mapRef.current) {
      const map = createRegionMap(container, () => {
        const cb = onReadyRef.current;
        if (typeof cb === "function") cb();
      });
      mapRef.current = map;
      roRef.current = new ResizeObserver(() => map.invalidateSize());
      roRef.current.observe(container);

      // A background click steps back ONE tier (same framing as drilling in,
      // reversed): in a district → fly back to its state; in a state → fly back to
      // the states overview. Clicks inside the current selection are ignored.
      map.on("click", (e) => {
        const o = optsRef.current;
        const { lng, lat } = e.latlng;
        if (o.selectedDistrict) {
          if (!isClickOutsideSelection(o.districts, o.selectedDistrict, lng, lat)) return;
          o.setSelectedDistrict(null);
          const sf = o.states.find((f) => (f.properties?.name as string) === o.selectedState);
          if (sf) {
            map.flyToBounds(L.geoJSON(sf).getBounds(), { padding: [30, 30], maxZoom: 8, duration: 0.85, easeLinearity: 0.25 });
          }
          return;
        }
        if (o.selectedState) {
          if (!isClickOutsideSelection(o.states, o.selectedState, lng, lat)) return;
          o.setSelectedState(null);
          o.setSelectedDistrict(null);
          map.flyToBounds(o.overviewBounds ?? indiaBounds(), { padding: [20, 20], duration: 0.85, easeLinearity: 0.25 });
        }
      });
    }

    return () => {
      destroyTimerRef.current = setTimeout(() => {
        roRef.current?.disconnect();
        roRef.current = null;
        mapRef.current?.remove();
        mapRef.current = null;
      }, 0);
    };
  }, [divRef]);

  // Frame to the states-with-customers ONCE, after the container has its final
  // size and that bounds is known (so the view centres on the real operating
  // area, whatever state it is). Falls back to the whole-India frame from
  // createRegionMap when there are no customers yet.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || hasFittedRef.current || !opts.overviewBounds) return;
    hasFittedRef.current = true;
    const bounds = opts.overviewBounds;
    requestAnimationFrame(() => {
      const m = mapRef.current;
      if (!m) return;
      m.invalidateSize();
      m.fitBounds(bounds, { padding: [20, 20], animate: false });
    });
  }, [opts.overviewBounds]);

  return mapRef;
}
