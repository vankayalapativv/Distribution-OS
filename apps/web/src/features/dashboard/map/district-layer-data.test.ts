import { describe, expect, it } from "vitest";
import { groupByDistrict, heatOpacity } from "./district-layer-data";
import type { MapCustomer } from "./map-helpers";

const at = (lat: number, lng: number): MapCustomer => ({
  id: `${lat},${lng}`, name: "S", code: "C", city: null, lat, lng,
  executiveId: null, executiveName: null, outstanding: 0, ageDays: null, bucket: null,
  lastOrderDays: null, lastCollectionDays: null, active: true,
});

const feat = (geometry: unknown, props: Record<string, unknown>) =>
  ({ type: "Feature", geometry, properties: props }) as unknown as GeoJSON.Feature;
// A stand-in district covering the Hyderabad area.
const districts: GeoJSON.Feature[] = [
  feat(
    { type: "Polygon", coordinates: [[[78.3, 17.2], [78.7, 17.2], [78.7, 17.6], [78.3, 17.6], [78.3, 17.2]]] },
    { name: "Hyderabad" },
  ),
];

describe("groupByDistrict", () => {
  it("groups by district and drops points outside every district", () => {
    const grouped = groupByDistrict(districts, [at(17.385, 78.4867), at(17.386, 78.4869), at(0, 0)]);
    // The two Hyderabad-area points land in the district; (0,0) is dropped.
    const total = [...grouped.values()].reduce((s, l) => s + l.length, 0);
    expect(total).toBe(2);
    expect(grouped.get("Hyderabad")).toHaveLength(2);
  });
});

describe("heatOpacity", () => {
  it("scales from the floor to the ceiling by √(count/max)", () => {
    expect(heatOpacity(0, 4)).toBeCloseTo(0.18);
    expect(heatOpacity(4, 4)).toBeCloseTo(0.6);
  });
});
