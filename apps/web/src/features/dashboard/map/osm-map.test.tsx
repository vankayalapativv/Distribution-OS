import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import type L from "leaflet";

const fitToPins = vi.fn();
vi.mock("./use-osm-map-init", () => ({ useOsmMapInit: () => createRef<L.Map | null>() }));
vi.mock("./use-district-layer", () => ({ useDistrictLayer: () => {} }));
vi.mock("./use-fit-button", () => ({ useFitButton: () => fitToPins }));
vi.mock("./use-telangana-districts", () => ({ useTelanganaDistricts: () => [] }));

import { OsmMap } from "./osm-map";

describe("OsmMap", () => {
  it("renders the map container + Fit button and wires the Fit click", () => {
    render(<OsmMap customers={[]} />);
    const fit = screen.getByRole("button", { name: /Fit/ });
    expect(fit).toBeInTheDocument();
    fireEvent.click(fit);
    expect(fitToPins).toHaveBeenCalled();
  });
});
