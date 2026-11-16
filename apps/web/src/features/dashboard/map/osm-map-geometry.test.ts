import { describe, expect, it } from "vitest";
import { isClickOutsideSelection } from "./osm-map-geometry";
import { districtOf } from "./district-helpers";

const feat = (geometry: unknown, props: Record<string, unknown>) =>
  ({ type: "Feature", geometry, properties: props }) as unknown as GeoJSON.Feature;
// A stand-in region covering the Hyderabad area (works for the state or district tier).
const regions: GeoJSON.Feature[] = [
  feat(
    { type: "Polygon", coordinates: [[[78.3, 17.2], [78.7, 17.2], [78.7, 17.6], [78.3, 17.6], [78.3, 17.2]]] },
    { name: "Hyderabad" },
  ),
];

describe("isClickOutsideSelection", () => {
  it("is false when nothing is selected", () => {
    expect(isClickOutsideSelection(regions, null, 78.4867, 17.385)).toBe(false);
  });
  it("is false when the click is inside the selected region", () => {
    const here = districtOf(regions, 78.4867, 17.385)!; // the region under Hyderabad
    expect(here).toBe("Hyderabad");
    expect(isClickOutsideSelection(regions, here, 78.4867, 17.385)).toBe(false);
  });
  it("is true when the click is outside the selected region", () => {
    expect(isClickOutsideSelection(regions, "Hyderabad", 0, 0)).toBe(true); // (0,0) is outside every region
  });
});
