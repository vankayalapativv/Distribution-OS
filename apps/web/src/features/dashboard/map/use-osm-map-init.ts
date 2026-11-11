import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import L from "leaflet";
import { ensureTooltipStyles } from "./map-tooltip";
import { createRegionMap, telanganaBounds } from "./create-region-map";
import { isClickOutsideDistrict } from "./osm-map-geometry";

/** Creates the Leaflet map once (via {@link createRegionMap}), frames the whole
 *  Telangana state on load, wires a click-outside-selected-district → fly-back-to-
 *  the-whole-state handler, and keeps the single instance alive across React
 *  StrictMode's dev double-mount (deferred teardown). Returns the map ref. */
export function useOsmMapInit(
  divRef: RefObject<HTMLDivElement | null>,
  selected: string | null,
  setSelected: Dispatch<SetStateAction<string | null>>,
  districts: readonly GeoJSON.Feature[],
  onRenderComplete?: () => void,
): RefObject<L.Map | null> {
  const mapRef = useRef<L.Map | null>(null);
  const selectedRef = useRef<string | null>(null);
  const districtsRef = useRef<readonly GeoJSON.Feature[]>(districts);
  const hasFittedRef = useRef(false);
  const roRef = useRef<ResizeObserver | null>(null);
  const destroyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onReadyRef = useRef(onRenderComplete);
  useEffect(() => { onReadyRef.current = onRenderComplete; }, [onRenderComplete]);

  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { districtsRef.current = districts; }, [districts]);

  useEffect(() => {
    const container = divRef.current;
    if (!container) return;
    ensureTooltipStyles();
    if (destroyTimerRef.current) {
      clearTimeout(destroyTimerRef.current);
      destroyTimerRef.current = null;
    }

    if (!mapRef.current) {
      // Defensive: the basemap's "idle" event can fire this after unmount; only
      // call back if it's still a function (never throw "not a function").
      const map = createRegionMap(container, () => {
        const cb = onReadyRef.current;
        if (typeof cb === "function") cb();
      });
      mapRef.current = map;
      roRef.current = new ResizeObserver(() => map.invalidateSize());
      roRef.current.observe(container);

      // Zoomed into a district, a click on the background OUTSIDE it flies back to
      // the whole-Telangana overview — same framing as the initial load (inside
      // clicks / no selection are ignored).
      map.on("click", (e) => {
        if (!isClickOutsideDistrict(districtsRef.current, selectedRef.current, e.latlng.lng, e.latlng.lat)) return;
        setSelected(null);
        map.flyToBounds(telanganaBounds(), { padding: [10, 10], duration: 0.85, easeLinearity: 0.25 });
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
  }, [divRef, setSelected]);

  // Frame the whole Telangana state ONCE, after the container has its final size
  // (so the state is centred regardless of where the pins fall). The "Fit" button
  // is what zooms to the pins on demand.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || hasFittedRef.current) return;
    hasFittedRef.current = true;
    requestAnimationFrame(() => {
      const m = mapRef.current;
      if (!m) return;
      m.invalidateSize();
      m.fitBounds(telanganaBounds(), { padding: [10, 10], animate: false });
    });
  }, []);

  return mapRef;
}
