import { afterEach, describe, expect, it, vi } from "vitest";

/** Load operating-states with a crafted (malformed) state dataset to exercise the
 *  defensive geometry guards that the real bundled data never hits. */
async function loadWith(features: unknown[]) {
  vi.resetModules();
  vi.doMock("vardhan-maps/data", () => ({ getStates: () => features }));
  return import("./operating-states");
}
afterEach(() => { vi.resetModules(); vi.clearAllMocks(); });

describe("operatingStatesOf — defensive geometry handling", () => {
  it("ignores empty rings, non-polygon geometries, and nameless matches", async () => {
    const { operatingStatesOf } = await loadWith([
      { geometry: { type: "Polygon", coordinates: [] }, properties: { name: "EmptyRings" } }, // no rings → skip
      { geometry: { type: "Point", coordinates: [5, 5] }, properties: { name: "NotAPolygon" } }, // unknown type → skip
      { geometry: { type: "Polygon", coordinates: [[[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]] }, properties: null }, // contains (5,5) but no name → null
    ]);
    // The point lands in the nameless square, so it resolves to no state.
    expect(operatingStatesOf([{ lat: 5, lng: 5 }])).toEqual([]);
  });

  it("reads the name from a MultiPolygon match", async () => {
    const { operatingStatesOf } = await loadWith([
      { geometry: { type: "MultiPolygon", coordinates: [[[[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]]] }, properties: { name: "Square" } },
    ]);
    expect(operatingStatesOf([{ lat: 5, lng: 5 }])).toEqual(["Square"]);
  });

  it("excludes a point sitting in a polygon hole", async () => {
    const { operatingStatesOf } = await loadWith([
      {
        geometry: {
          type: "Polygon",
          coordinates: [
            [[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]], // outer
            [[3, 3], [3, 7], [7, 7], [7, 3], [3, 3]], // hole around (5,5)
          ],
        },
        properties: { name: "Holed" },
      },
    ]);
    expect(operatingStatesOf([{ lat: 5, lng: 5 }])).toEqual([]); // inside the hole → outside the state
  });
});
