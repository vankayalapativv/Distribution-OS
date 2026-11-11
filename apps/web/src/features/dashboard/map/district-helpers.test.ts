import { describe, expect, it } from "vitest";
import { anchorOf, districtAnchors, districtOf, featureName, inPolygon, inRing, polygonsOf } from "./district-helpers";

const feat = (geometry: unknown, props: Record<string, unknown> | null = null) =>
  ({ type: "Feature", geometry, properties: props }) as unknown as GeoJSON.Feature;

// A unit square with a square hole in the middle.
const outer = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
const hole = [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]];

// A stand-in district covering the Hyderabad area, for the parametrized helpers.
const hydRing = [[78.3, 17.2], [78.7, 17.2], [78.7, 17.6], [78.3, 17.6], [78.3, 17.2]];
const districts: GeoJSON.Feature[] = [
  feat({ type: "Polygon", coordinates: [hydRing] }, { name: "Hyderabad" }),
];

describe("ray-casting internals", () => {
  it("inRing: inside vs outside the polygon", () => {
    expect(inRing(5, 5, outer)).toBe(true);
    expect(inRing(20, 20, outer)).toBe(false);
  });
  it("inPolygon: inside the ring but not in the hole", () => {
    expect(inPolygon(1, 1, [outer])).toBe(true);
    expect(inPolygon(1, 1, [outer, hole])).toBe(true); // inside outer, past the hole loop
    expect(inPolygon(5, 5, [outer, hole])).toBe(false); // in the hole
    expect(inPolygon(50, 50, [outer])).toBe(false); // outside outer
    expect(inPolygon(0, 0, [])).toBe(false); // no rings
  });
  it("polygonsOf: Polygon, MultiPolygon and non-area geometry", () => {
    expect(polygonsOf({ type: "Polygon", coordinates: [outer] } as GeoJSON.Geometry).length).toBe(1);
    expect(polygonsOf({ type: "MultiPolygon", coordinates: [[outer], [hole]] } as GeoJSON.Geometry).length).toBe(2);
    expect(polygonsOf({ type: "Point", coordinates: [0, 0] } as GeoJSON.Geometry)).toEqual([]);
  });
});

describe("districtOf", () => {
  it("finds the district (in the supplied set) containing a Hyderabad-area point", () => {
    expect(districtOf(districts, 78.4867, 17.385)).toBe("Hyderabad");
  });
  it("returns null for a point outside every supplied district", () => {
    expect(districtOf(districts, 0, 0)).toBeNull();
  });
});

describe("featureName", () => {
  it("returns the name or null when absent", () => {
    expect(featureName(feat(null, { name: "Hyderabad" }))).toBe("Hyderabad");
    expect(featureName(feat(null, null))).toBeNull();
  });
});

describe("anchorOf", () => {
  it("averages the largest polygon's outer ring", () => {
    const a = anchorOf(feat({ type: "MultiPolygon", coordinates: [[[[0, 0], [2, 0], [2, 2], [0, 0]]], [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]]] }, { name: "D" }));
    expect(a.name).toBe("D");
    expect(a.lng).toBeGreaterThan(0);
  });
  it("keeps the first (larger) polygon when a later one is smaller", () => {
    // big outer first, small second → the `outer.length > best.length` false branch.
    const a = anchorOf(feat({ type: "MultiPolygon", coordinates: [[[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]], [[[0, 0], [1, 0], [1, 1], [0, 0]]]] }, { name: "D" }));
    expect(a.lng).toBeGreaterThan(2);
  });
  it("falls back to (0,0) and empty name when there is no geometry", () => {
    expect(anchorOf(feat({ type: "Point", coordinates: [1, 2] }, null))).toEqual({ name: "", lat: 0, lng: 0 });
  });
});

describe("districtAnchors", () => {
  it("returns a label anchor per district and caches per feature-array", () => {
    const first = districtAnchors(districts);
    expect(first.length).toBe(districts.length);
    expect(first[0]).toHaveProperty("lat");
    expect(first[0].name).toBe("Hyderabad");
    expect(districtAnchors(districts)).toBe(first); // cached (same array ⇒ same result)
  });
});
