import { afterEach, describe, expect, it, vi } from "vitest";
import type { BandMeta, MapCustomer } from "./map-helpers";

const h = vi.hoisted(() => {
  const handlers: Record<string, () => void> = {};
  const layer = { bindTooltip: vi.fn(), on: vi.fn((ev: string, cb: () => void) => { handlers[ev] = cb; }), setStyle: vi.fn(), getBounds: vi.fn(() => "B"), addTo: vi.fn() };
  const circle = { bindPopup: vi.fn(() => circle), addTo: vi.fn() };
  const marker = { addTo: vi.fn() };
  return { handlers, layer, circle, marker, L: { geoJSON: vi.fn(() => layer), circleMarker: vi.fn(() => circle), marker: vi.fn(() => marker) } };
});
vi.mock("leaflet", () => ({ default: h.L }));
vi.mock("./map-markers", () => ({ customerDotPopup: () => "POPUP", districtCountIcon: () => "ICON" }));
vi.mock("./map-tooltip", () => ({ districtHoverTooltip: () => "TIP" }));
const districtAnchors = vi.fn();
vi.mock("./district-helpers", () => ({ districtAnchors: (...a: unknown[]) => districtAnchors(...a) }));

import { drawCountBadges, drawDot, drawHeatRegion } from "./district-layer-parts";

const meta = { order: [], label: () => "", color: () => "" } as BandMeta;
const cust = (): MapCustomer => ({ id: "c", lat: 17, lng: 78, bucket: "0" } as MapCustomer);
const feature = { type: "Feature", properties: { name: "Telangana" } } as unknown as GeoJSON.Feature;

afterEach(() => { vi.clearAllMocks(); for (const k of Object.keys(h.handlers)) delete h.handlers[k]; });

describe("drawDot", () => {
  it("draws a dues-coloured circle with a popup", () => {
    drawDot({} as never, cust(), meta);
    expect(h.L.circleMarker).toHaveBeenCalledWith([17, 78], expect.objectContaining({ fillColor: expect.any(String) }));
    expect(h.circle.bindPopup).toHaveBeenCalledWith("POPUP");
    expect(h.circle.addTo).toHaveBeenCalled();
  });
});

describe("drawHeatRegion", () => {
  it("binds the tooltip, wires hover/out/click, and adds the layer", () => {
    const onClick = vi.fn();
    drawHeatRegion({} as never, feature, "Telangana", [cust()], 5, { color: "#000" }, meta, onClick);
    expect(h.layer.bindTooltip).toHaveBeenCalledWith("TIP", expect.objectContaining({ className: "district-tip" }));
    expect(h.layer.addTo).toHaveBeenCalled();
    h.handlers.mouseover();
    expect(h.layer.setStyle).toHaveBeenCalledWith(expect.objectContaining({ weight: 3 }));
    h.handlers.mouseout();
    expect(h.layer.setStyle).toHaveBeenCalledWith(expect.objectContaining({ fillColor: expect.any(String) }));
    h.handlers.click();
    expect(onClick).toHaveBeenCalledWith(h.layer);
  });
});

describe("drawCountBadges", () => {
  it("places a badge only where a region has customers", () => {
    districtAnchors.mockReturnValue([{ name: "A", lat: 1, lng: 2 }, { name: "B", lat: 3, lng: 4 }]);
    drawCountBadges({} as never, [feature], new Map([["A", [cust()]]])); // B has none → skipped
    expect(h.L.marker).toHaveBeenCalledTimes(1);
    expect(h.L.marker).toHaveBeenCalledWith([1, 2], expect.anything());
  });
});
