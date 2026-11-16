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

describe("useFitButton", () => {
  it("fits the map to the customer bounds when invoked (any state)", () => {
    const map = fakeMap();
    const ref = createRef<L.Map | null>();
    (ref as { current: L.Map | null }).current = map;
    // Customers in two different states — the map is no longer region-locked.
    const { result } = renderHook(() => useFitButton(ref, [cust(17, 78), cust(16.5, 80.6)]));
    result.current();
    expect(map.invalidateSize).toHaveBeenCalled();
    expect(map.fitBounds).toHaveBeenCalled();
  });

  it("does nothing when no customer has a real coordinate", () => {
    const map = fakeMap();
    const ref = createRef<L.Map | null>();
    (ref as { current: L.Map | null }).current = map;
    const { result } = renderHook(() => useFitButton(ref, [cust(Number.NaN, Number.NaN)]));
    result.current();
    expect(map.fitBounds).not.toHaveBeenCalled();
  });

  it("does nothing when the map is not yet created", () => {
    const ref = createRef<L.Map | null>();
    const { result } = renderHook(() => useFitButton(ref, [cust(17, 78)]));
    expect(() => result.current()).not.toThrow();
  });
});
