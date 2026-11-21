import { afterEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const mapObj = { fitBounds: vi.fn(), attributionControl: { setPrefix: vi.fn() } };
  const boundsObj = { getCenter: () => [20, 78], pad: (n: number) => ({ padded: n }) };
  const geoLayer = { addTo: vi.fn() };
  const Lmock = {
    latLngBounds: vi.fn(() => boundsObj),
    map: vi.fn(() => mapObj),
    geoJSON: vi.fn(() => geoLayer),
  };
  return { mapObj, boundsObj, geoLayer, Lmock };
});
const { mapObj, boundsObj, geoLayer, Lmock } = h;
vi.mock("leaflet", () => ({ default: h.Lmock }));
vi.mock("leaflet/dist/leaflet.css", () => ({}));
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));
vi.mock("vardhan-maps/data", () => ({ indiaOutline: { type: "FeatureCollection", features: [] } }));
const addVectorBasemap = vi.fn();
vi.mock("@/lib/basemap", () => ({ addVectorBasemap: (...a: unknown[]) => addVectorBasemap(...a) }));
vi.mock("./map-constants", () => ({ INDIA_BOUNDS: [[6, 68], [37, 98]], INDIA_MIN_ZOOM: 4 }));

import { createRegionMap, indiaBounds } from "./create-region-map";

const flush = () => new Promise((r) => setTimeout(r, 0));
afterEach(() => vi.clearAllMocks());

describe("indiaBounds", () => {
  it("builds the LatLngBounds from the India box", () => {
    expect(indiaBounds()).toBe(boundsObj);
    expect(Lmock.latLngBounds).toHaveBeenCalledWith([[6, 68], [37, 98]]);
  });
});

describe("createRegionMap", () => {
  it("creates the map, frames India, adds the outline, and fires onReady via the GL idle event", async () => {
    const once = vi.fn((_ev: string, cb: () => void) => cb());
    addVectorBasemap.mockResolvedValue({ getMaplibreMap: () => ({ once }) });
    const onReady = vi.fn();
    const map = createRegionMap(document.createElement("div"), onReady);
    expect(map).toBe(mapObj);
    expect(mapObj.fitBounds).toHaveBeenCalled();
    expect(mapObj.attributionControl.setPrefix).toHaveBeenCalledWith(false);
    expect(geoLayer.addTo).toHaveBeenCalledWith(mapObj);
    await flush();
    expect(once).toHaveBeenCalledWith("idle", onReady);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("fires onReady immediately when the layer exposes no MapLibre map", async () => {
    addVectorBasemap.mockResolvedValue({}); // getMaplibreMap?.() → undefined → glMap null
    const onReady = vi.fn();
    createRegionMap(document.createElement("div"), onReady);
    await flush();
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("fires onReady immediately when no basemap layer is returned", async () => {
    addVectorBasemap.mockResolvedValue(null); // layer falsy → glMap null
    const onReady = vi.fn();
    createRegionMap(document.createElement("div"), onReady);
    await flush();
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});
