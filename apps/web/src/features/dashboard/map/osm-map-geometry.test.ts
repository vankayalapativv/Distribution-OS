import { describe, expect, it } from "vitest";
import { buildRegionMask, isClickOutsideDistrict } from "./osm-map-geometry";
import { districtOf } from "./district-helpers";

const feat = (geometry: unknown, props: Record<string, unknown>) =>
  ({ type: "Feature", geometry, properties: props }) as unknown as GeoJSON.Feature;
// A stand-in district covering the Hyderabad area.
const districts: GeoJSON.Feature[] = [
  feat(
    { type: "Polygon", coordinates: [[[78.3, 17.2], [78.7, 17.2], [78.7, 17.6], [78.3, 17.6], [78.3, 17.2]]] },
    { name: "Hyderabad" },
  ),
];

describe("buildRegionMask", () => {
  it("is a polygon whose first ring is the world and the rest are state holes", () => {
    const mask = buildRegionMask();
    expect(mask.type).toBe("Polygon");
    // world ring + the Telangana hole.
    expect(mask.coordinates.length).toBe(2);
    expect(mask.coordinates[0]).toEqual([[-179, -85], [179, -85], [179, 85], [-179, 85], [-179, -85]]);
  });
});

describe("isClickOutsideDistrict", () => {
  it("is false when nothing is selected", () => {
    expect(isClickOutsideDistrict(districts, null, 78.4867, 17.385)).toBe(false);
  });
  it("is false when the click is inside the selected district", () => {
    const here = districtOf(districts, 78.4867, 17.385)!; // the district under Hyderabad
    expect(here).toBe("Hyderabad");
    expect(isClickOutsideDistrict(districts, here, 78.4867, 17.385)).toBe(false);
  });
  it("is true when the click is outside the selected district", () => {
    expect(isClickOutsideDistrict(districts, "Hyderabad", 0, 0)).toBe(true); // (0,0) is outside every district
  });
});
