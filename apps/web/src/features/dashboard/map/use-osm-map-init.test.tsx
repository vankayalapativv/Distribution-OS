import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import type L from "leaflet";
import type { OsmMapInitOptions } from "./osm-map-init-options";

const h = vi.hoisted(() => ({
  clickHandler: null as ((e: unknown) => void) | null,
  readyCb: null as (() => void) | null,
  roCb: null as (() => void) | null,
  rafCb: null as null | (() => void),
}));
const mapObj = { on: vi.fn((ev: string, fn: (e: unknown) => void) => { if (ev === "click") h.clickHandler = fn; }), invalidateSize: vi.fn(), fitBounds: vi.fn(), remove: vi.fn() };
const createRegionMap = vi.fn((_c: HTMLElement, onReady: () => void) => { h.readyCb = onReady; return mapObj; });
vi.mock("./create-region-map", () => ({ createRegionMap: (...a: [HTMLElement, () => void]) => createRegionMap(...a) }));
const ensureTooltipStyles = vi.fn();
vi.mock("./map-tooltip", () => ({ ensureTooltipStyles: () => ensureTooltipStyles() }));
const stepBackOnClick = vi.fn();
vi.mock("./osm-map-back-nav", () => ({ stepBackOnClick: (...a: unknown[]) => stepBackOnClick(...a) }));

import { useOsmMapInit } from "./use-osm-map-init";

const divRef = () => { const r = createRef<HTMLDivElement>(); (r as { current: HTMLDivElement }).current = document.createElement("div"); return r; };
const opts = (over: Partial<OsmMapInitOptions> = {}): OsmMapInitOptions => ({
  selectedState: null, selectedDistrict: null, setSelectedState: vi.fn(), setSelectedDistrict: vi.fn(),
  states: [], districts: [], overviewBounds: null, ...over,
});
const bounds = { _b: true } as unknown as L.LatLngBounds;

beforeEach(() => {
  vi.useFakeTimers();
  h.clickHandler = h.readyCb = h.roCb = h.rafCb = null;
  vi.stubGlobal("ResizeObserver", class { constructor(cb: () => void) { h.roCb = cb; } observe = vi.fn(); disconnect = vi.fn(); });
  vi.stubGlobal("requestAnimationFrame", (cb: () => void) => { h.rafCb = cb; return 1; });
});
afterEach(() => { vi.clearAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("useOsmMapInit", () => {
  it("no-ops (no map) when the container ref is empty, and skips the fit", () => {
    renderHook(() => useOsmMapInit(createRef<HTMLDivElement>(), opts({ overviewBounds: bounds })));
    expect(createRegionMap).not.toHaveBeenCalled();
    expect(h.rafCb).toBeNull(); // second effect: !map → return
  });

  it("creates the map, observes resize, and wires click + background step-back", () => {
    const onReady = vi.fn();
    const o = opts();
    renderHook(() => useOsmMapInit(divRef(), o, onReady));
    expect(ensureTooltipStyles).toHaveBeenCalled();
    expect(createRegionMap).toHaveBeenCalledTimes(1);
    h.readyCb?.(); // createRegionMap's onReady → onRenderComplete?.()
    expect(onReady).toHaveBeenCalled();
    h.roCb?.(); // ResizeObserver callback
    expect(mapObj.invalidateSize).toHaveBeenCalled();
    h.clickHandler?.({ latlng: { lng: 78, lat: 17 } });
    expect(stepBackOnClick).toHaveBeenCalledWith(mapObj, o, 78, 17);
  });

  it("ready callback is a no-op when no onRenderComplete is given", () => {
    renderHook(() => useOsmMapInit(divRef(), opts()));
    expect(() => h.readyCb?.()).not.toThrow(); // onReadyRef.current?.() → undefined
  });

  it("frames to the overview bounds once, then not again on re-render", () => {
    const { rerender } = renderHook(({ o }) => useOsmMapInit(divRef(), o), { initialProps: { o: opts({ overviewBounds: bounds }) } });
    expect(h.rafCb).toBeTypeOf("function");
    h.rafCb?.(); // runs the frame: invalidateSize + fitBounds
    expect(mapObj.fitBounds).toHaveBeenCalledWith(bounds, { padding: [20, 20], animate: false });
    h.rafCb = null;
    rerender({ o: opts({ overviewBounds: bounds }) }); // hasFittedRef guard → no second frame
    expect(h.rafCb).toBeNull();
  });

  it("skips the deferred frame if the map was torn down before it ran", () => {
    const { unmount } = renderHook(() => useOsmMapInit(divRef(), opts({ overviewBounds: bounds })));
    const frame = h.rafCb!;
    unmount();
    vi.advanceTimersByTime(1); // destroy timer nulls mapRef
    expect(() => frame()).not.toThrow(); // if (!m) return
    expect(mapObj.fitBounds).not.toHaveBeenCalled();
  });

  it("tears down (disconnect + remove) after the deferred timer", () => {
    const ro = { disconnect: vi.fn() };
    vi.stubGlobal("ResizeObserver", class { constructor() { h.roCb = () => {}; } observe = vi.fn(); disconnect = ro.disconnect; });
    const { unmount } = renderHook(() => useOsmMapInit(divRef(), opts()));
    unmount();
    vi.advanceTimersByTime(1);
    expect(ro.disconnect).toHaveBeenCalled();
    expect(mapObj.remove).toHaveBeenCalled();
  });

  it("clears a pending destroy timer when the effect re-initialises", () => {
    const ref = divRef();
    const { rerender } = renderHook(({ r }) => useOsmMapInit(r, opts()), { initialProps: { r: ref } });
    rerender({ r: divRef() }); // cleanup schedules a destroy timer, re-run clears it
    vi.advanceTimersByTime(1);
    expect(createRegionMap).toHaveBeenCalledTimes(1); // map reused (not recreated)
  });
});
