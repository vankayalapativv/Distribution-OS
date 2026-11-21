import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import type L from "leaflet";
import type { MapCustomer } from "./map-helpers";

const fitToPins = vi.fn();
const initArgs = vi.fn();
vi.mock("./use-osm-map-init", () => ({
  useOsmMapInit: (...a: unknown[]) => {
    initArgs(...a);
    return createRef<L.Map | null>();
  },
}));
vi.mock("./use-district-layer", () => ({ useMapLayer: () => {} }));
vi.mock("./use-fit-button", () => ({ useFitButton: () => fitToPins }));
const useAllStates = vi.fn(() => [] as GeoJSON.Feature[]);
vi.mock("./use-map-geodata", () => ({ useAllStates: () => useAllStates(), useStateDistricts: () => [] }));
const groupByRegion = vi.fn();
vi.mock("./district-layer-data", () => ({ groupByRegion: (...a: unknown[]) => groupByRegion(...a) }));
vi.mock("leaflet", () => ({
  default: { geoJSON: vi.fn(() => ({ getBounds: () => ({ _bounds: true }) })) },
}));

import { OsmMap } from "./osm-map";

const cust = (id: string): MapCustomer => ({ id } as MapCustomer);

describe("OsmMap", () => {
  it("renders the map container + Fit button and wires the Fit click", () => {
    render(<OsmMap customers={[]} />);
    const fit = screen.getByRole("button", { name: /Fit/ });
    expect(fit).toBeInTheDocument();
    fireEvent.click(fit);
    expect(fitToPins).toHaveBeenCalled();
  });

  it("frames to the states that actually have customers", () => {
    useAllStates.mockReturnValue([
      { type: "Feature", properties: { name: "Telangana" } } as unknown as GeoJSON.Feature,
      { type: "Feature", properties: null } as unknown as GeoJSON.Feature, // properties?.name ?? "" branch
    ]);
    groupByRegion.mockReturnValue(new Map([["Telangana", [cust("c1")]]]));
    initArgs.mockClear();
    render(<OsmMap customers={[cust("c1")]} />);
    const opts = initArgs.mock.calls.at(-1)![1] as { overviewBounds: unknown };
    expect(opts.overviewBounds).toEqual({ _bounds: true });
  });

  it("has no overview bounds when no state contains any customer", () => {
    useAllStates.mockReturnValue([{ type: "Feature", properties: { name: "Telangana" } } as unknown as GeoJSON.Feature]);
    groupByRegion.mockReturnValue(new Map()); // withCustomers empty → null
    initArgs.mockClear();
    render(<OsmMap customers={[cust("c1")]} />);
    const opts = initArgs.mock.calls.at(-1)![1] as { overviewBounds: unknown };
    expect(opts.overviewBounds).toBeNull();
  });
});
