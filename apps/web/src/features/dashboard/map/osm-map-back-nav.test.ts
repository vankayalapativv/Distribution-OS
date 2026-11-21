import { afterEach, describe, expect, it, vi } from "vitest";
import type { OsmMapInitOptions } from "./osm-map-init-options";

const geoBounds = { _b: true };
vi.mock("leaflet", () => ({ default: { geoJSON: vi.fn(() => ({ getBounds: () => geoBounds })) } }));
const isClickOutsideSelection = vi.fn();
vi.mock("./osm-map-geometry", () => ({ isClickOutsideSelection: (...a: unknown[]) => isClickOutsideSelection(...a) }));
vi.mock("./create-region-map", () => ({ indiaBounds: () => ({ _india: true }) }));

import { stepBackOnClick } from "./osm-map-back-nav";

const stateFeature = { type: "Feature", properties: { name: "Telangana" } } as unknown as GeoJSON.Feature;
const opts = (over: Partial<OsmMapInitOptions>): OsmMapInitOptions => ({
  selectedState: null, selectedDistrict: null,
  setSelectedState: vi.fn(), setSelectedDistrict: vi.fn(),
  states: [stateFeature], districts: [], overviewBounds: null, ...over,
});
const map = () => ({ flyToBounds: vi.fn() }) as unknown as import("leaflet").Map;

afterEach(() => vi.clearAllMocks());

describe("stepBackOnClick", () => {
  it("ignores a district click inside the current district", () => {
    isClickOutsideSelection.mockReturnValue(false);
    const o = opts({ selectedDistrict: "Hyderabad" });
    const m = map();
    stepBackOnClick(m, o, 78, 17);
    expect(o.setSelectedDistrict).not.toHaveBeenCalled();
    expect(m.flyToBounds).not.toHaveBeenCalled();
  });

  it("district → flies back to the parent state when found", () => {
    isClickOutsideSelection.mockReturnValue(true);
    const o = opts({ selectedDistrict: "Hyderabad", selectedState: "Telangana" });
    const m = map();
    stepBackOnClick(m, o, 1, 1);
    expect(o.setSelectedDistrict).toHaveBeenCalledWith(null);
    expect(m.flyToBounds).toHaveBeenCalledWith(geoBounds, expect.objectContaining({ maxZoom: 8 }));
  });

  it("district → no fly when the parent state feature isn't found", () => {
    isClickOutsideSelection.mockReturnValue(true);
    const o = opts({ selectedDistrict: "Hyderabad", selectedState: "Unknown" }); // find → undefined
    const m = map();
    stepBackOnClick(m, o, 1, 1);
    expect(o.setSelectedDistrict).toHaveBeenCalledWith(null);
    expect(m.flyToBounds).not.toHaveBeenCalled();
  });

  it("ignores a state click inside the current state", () => {
    isClickOutsideSelection.mockReturnValue(false);
    const o = opts({ selectedState: "Telangana" });
    const m = map();
    stepBackOnClick(m, o, 1, 1);
    expect(o.setSelectedState).not.toHaveBeenCalled();
  });

  it("state → flies back to the overview bounds when known", () => {
    isClickOutsideSelection.mockReturnValue(true);
    const o = opts({ selectedState: "Telangana", overviewBounds: { _ov: true } as unknown as import("leaflet").LatLngBounds });
    const m = map();
    stepBackOnClick(m, o, 1, 1);
    expect(o.setSelectedState).toHaveBeenCalledWith(null);
    expect(m.flyToBounds).toHaveBeenCalledWith({ _ov: true }, expect.objectContaining({ padding: [20, 20] }));
  });

  it("state → falls back to the whole-India frame when there are no overview bounds", () => {
    isClickOutsideSelection.mockReturnValue(true);
    const o = opts({ selectedState: "Telangana", overviewBounds: null }); // ?? indiaBounds()
    const m = map();
    stepBackOnClick(m, o, 1, 1);
    expect(m.flyToBounds).toHaveBeenCalledWith({ _india: true }, expect.anything());
  });

  it("does nothing at the overview tier (no state, no district)", () => {
    const o = opts({});
    const m = map();
    stepBackOnClick(m, o, 1, 1);
    expect(m.flyToBounds).not.toHaveBeenCalled();
  });
});
