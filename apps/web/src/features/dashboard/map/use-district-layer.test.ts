import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BandMeta, MapCustomer } from "./map-helpers";
import type L from "leaflet";

const group = { addTo: vi.fn(), remove: vi.fn() };
vi.mock("leaflet", () => ({ default: { layerGroup: vi.fn(() => group) } }));
const drawStatesOverview = vi.fn();
const drawStateDetail = vi.fn();
const drawDistrictDetail = vi.fn();
vi.mock("./district-layer-tiers", () => ({
  drawStatesOverview: (...a: unknown[]) => drawStatesOverview(...a),
  drawStateDetail: (...a: unknown[]) => drawStateDetail(...a),
  drawDistrictDetail: (...a: unknown[]) => drawDistrictDetail(...a),
}));
const groupByRegion = vi.fn((..._a: unknown[]) => new Map());
vi.mock("./district-layer-data", () => ({ groupByRegion: (...a: unknown[]) => groupByRegion(...a) }));

import { useMapLayer } from "./use-district-layer";

const meta = {} as BandMeta;
const mapRef = (map: unknown) => ({ current: map }) as React.RefObject<L.Map | null>;
const states = [{ type: "Feature", properties: { name: "Telangana" } }] as unknown as GeoJSON.Feature[];
const run = (map: unknown, selState: string | null, selDist: string | null, st = states) =>
  renderHook(() => useMapLayer(mapRef(map), [] as MapCustomer[], st, [], selState, selDist, vi.fn(), vi.fn(), meta));

afterEach(() => vi.clearAllMocks());

describe("useMapLayer", () => {
  it("does nothing when the map isn't ready", () => {
    run(null, null, null);
    expect(drawStatesOverview).not.toHaveBeenCalled();
    expect(group.addTo).not.toHaveBeenCalled();
  });

  it("draws the overview tier when no state is selected", () => {
    run({}, null, null);
    expect(drawStatesOverview).toHaveBeenCalled();
    expect(group.addTo).toHaveBeenCalled();
  });

  it("draws the state-detail tier (resolving the state feature, skipping null-props) for a state with no district", () => {
    const withNull = [{ type: "Feature", properties: null } as unknown as GeoJSON.Feature, ...states]; // regionName → ?? ""
    run({}, "Telangana", null, withNull);
    expect(drawStateDetail).toHaveBeenCalledWith(group, {}, states[0], [], expect.any(Map), expect.any(Function), meta);
  });

  it("draws the district-detail tier when a district is selected", () => {
    run({}, "Telangana", "Hyderabad");
    expect(drawDistrictDetail).toHaveBeenCalled();
    expect(drawStateDetail).not.toHaveBeenCalled();
  });

  it("removes the previous layer group before redrawing", () => {
    const { rerender } = renderHook(({ s }) => useMapLayer(mapRef({}), [] as MapCustomer[], states, [], s, null, vi.fn(), vi.fn(), meta), { initialProps: { s: null as string | null } });
    rerender({ s: "Telangana" });
    expect(group.remove).toHaveBeenCalled();
  });
});
