import { TELANGANA_BOUNDARY } from "./telangana-boundary";
import { districtOf } from "./district-helpers";

/** Opaque land-coloured clip covering everything OUTSIDE Telangana: a world ring
 *  with Telangana punched out as a hole (Leaflet's evenodd fill-rule turns the
 *  inner ring into a hole). The client operates in Greater Hyderabad, which sits
 *  wholly within Telangana. Pure GeoJSON. */
export function buildRegionMask(): GeoJSON.Polygon {
  const worldRing: GeoJSON.Position[] = [
    [-179, -85], [179, -85], [179, 85], [-179, 85], [-179, -85],
  ];
  return {
    type: "Polygon",
    coordinates: [worldRing, TELANGANA_BOUNDARY.coordinates[0]],
  };
}

/** True when a map click at [lng,lat] falls outside the currently-selected
 *  district (so the view should fly back to the overview). A click with no
 *  district selected, or inside the selected district, is a no-op. */
export function isClickOutsideDistrict(
  features: readonly GeoJSON.Feature[],
  selected: string | null,
  lng: number,
  lat: number,
): boolean {
  return selected != null && districtOf(features, lng, lat) !== selected;
}
