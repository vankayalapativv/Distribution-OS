import { useEffect, useRef, type RefObject } from "react";
import type L from "leaflet";
import { ensureTooltipStyles } from "./map-tooltip";
import { createRegionMap } from "./create-region-map";
import { stepBackOnClick } from "./osm-map-back-nav";
import type { OsmMapInitOptions } from "./osm-map-init-options";

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
      const map = createRegionMap(container, () => onReadyRef.current?.());
      mapRef.current = map;
      roRef.current = new ResizeObserver(() => map.invalidateSize());
      roRef.current.observe(container);
      map.on("click", (e) => {
        const { lng, lat } = (e as L.LeafletMouseEvent).latlng;
        stepBackOnClick(map, optsRef.current, lng, lat);
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
  // area). Falls back to the whole-India frame from createRegionMap when there
  // are no customers yet.
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
