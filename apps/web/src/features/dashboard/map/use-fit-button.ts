import { useEffect, useRef, type RefObject } from "react";
import L from "leaflet";
import { type MapCustomer } from "./map-helpers";
import { districtOf } from "./district-helpers";

// `animate: false` is essential — an animated fit on first load gets interrupted
// by layout/invalidateSize and settles at a too-far-out zoom.
const FIT_OPTS = { padding: [40, 40] as [number, number], maxZoom: 14, animate: false };

/** Tracks the customer bounds and returns a `fitToPins` handler for the "Fit"
 *  button — the only thing that zooms to the pins. Frames only customers that
 *  fall inside a district (the ones actually drawn); out-of-district pins are
 *  ignored, so a stray coordinate can't zoom the view out. */
export function useFitButton(
  mapRef: RefObject<L.Map | null>,
  customers: MapCustomer[],
  districts: readonly GeoJSON.Feature[],
) {
  const fitBoundsRef = useRef<L.LatLngBounds | null>(null);

  useEffect(() => {
    const pins = customers.filter((c) => districtOf(districts, c.lng, c.lat));
    fitBoundsRef.current = pins.length
      ? L.latLngBounds(pins.map((c) => [c.lat, c.lng] as [number, number]))
      : null;
  }, [customers, districts]);

  return () => {
    const map = mapRef.current;
    if (map && fitBoundsRef.current) {
      map.invalidateSize();
      map.fitBounds(fitBoundsRef.current, FIT_OPTS);
    }
  };
}
