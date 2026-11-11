import { renderHook } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import type L from "leaflet";
import { useFitButton } from "./use-fit-button";
import type { MapCustomer } from "./map-helpers";

const cust = (lat: number, lng: number): MapCustomer => ({
  id: "c", name: "S", code: "C", city: null, lat, lng,
  executiveId: null, executiveName: null, outstanding: 0, ageDays: null, bucket: null,
  lastOrderDays: null, lastCollectionDays: null, active: true,
});

function fakeMap() {
  return { invalidateSize: vi.fn(), fitBounds: vi.fn() } as unknown as L.Map;
}

const feat = (geometry: unknown, props: Record<string, unknown>) =>
  ({ type: "Feature", geometry, properties: props }) as unknown as GeoJSON.Feature;
// A district covering (lat 16–19, lng 77–80) — both test customers fall inside.
const districts: GeoJSON.Feature[] = [
  feat(
    { type: "Polygon", coordinates: [[[77, 16], [80, 16], [80, 19], [77, 19], [77, 16]]] },
    { name: "D" },
  ),
];

describe("useFitButton", () => {
  it("fits the map to the in-district customer bounds when invoked", () => {
    const map = fakeMap();
    const ref = createRef<L.Map | null>();
    (ref as { current: L.Map | null }).current = map;
    const { result } = renderHook(() => useFitButton(ref, [cust(17, 78), cust(18, 79)], districts));
    result.current();
    expect(map.invalidateSize).toHaveBeenCalled();
    expect(map.fitBounds).toHaveBeenCalled();
  });

  it("does nothing when there are no in-district customers", () => {
    const map = fakeMap();
    const ref = createRef<L.Map | null>();
    (ref as { current: L.Map | null }).current = map;
    // (0,0) falls outside the district, so there is nothing to fit.
    const { result } = renderHook(() => useFitButton(ref, [cust(0, 0)], districts));
    result.current();
    expect(map.fitBounds).not.toHaveBeenCalled();
  });

  it("does nothing when the map is not yet created", () => {
    const ref = createRef<L.Map | null>();
    const { result } = renderHook(() => useFitButton(ref, [cust(17, 78)], districts));
    expect(() => result.current()).not.toThrow();
  });
});
