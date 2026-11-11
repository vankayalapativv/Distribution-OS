import { describe, expect, it } from "vitest";
import type * as LType from "leaflet";
import { guardMaplibreLeaflet } from "./maplibre-leaflet-guard";

/** A fake Leaflet whose L.MaplibreGL.prototype mirrors the real plugin methods
 *  that read `this._map` (and would throw getZoom-on-null after teardown), plus
 *  the `L.Util`/`L.DomUtil` helpers the guarded `_transitionEnd` reimplementation
 *  uses. `requestAnimFrame` runs synchronously so the rAF body is exercised. */
function makeFakeL() {
  function MaplibreGL(this: Record<string, unknown>) {}
  MaplibreGL.prototype._transformGL = function (this: { _map: { getZoom: () => number } }) {
    return this._map.getZoom(); // throws if _map is null
  };
  // The original plugin method reads _map synchronously; the guard REPLACES it
  // with a rAF-based version, so this body is never actually used post-guard.
  MaplibreGL.prototype._transitionEnd = function (this: { _map: { getCenter: () => string } }) {
    return this._map.getCenter();
  };
  MaplibreGL.prototype._zoomStart = function (this: Record<string, unknown>) {
    this.started = true;
    return "started";
  };
  return {
    MaplibreGL,
    Util: {
      requestAnimFrame: (fn: (this: unknown) => void, ctx: unknown) => fn.call(ctx), // run now
      bind: (fn: () => void, ctx: unknown) => fn.bind(ctx),
    },
    DomUtil: { setTransform: () => {} },
  } as unknown as typeof LType;
}

describe("guardMaplibreLeaflet", () => {
  it("returns false when the plugin (L.MaplibreGL) isn't loaded yet", () => {
    expect(guardMaplibreLeaflet({} as unknown as typeof LType)).toBe(false);
  });

  it("no-ops guarded methods when the layer has been torn down (no getZoom crash)", () => {
    const L = makeFakeL();
    expect(guardMaplibreLeaflet(L)).toBe(true);
    const proto = (L as unknown as { MaplibreGL: { prototype: Record<string, (this: unknown) => unknown> } }).MaplibreGL.prototype;

    // _map/_glMap null (removed) → returns undefined instead of throwing.
    expect(proto._transformGL.call({ _map: null, _glMap: null })).toBeUndefined();
    expect(proto._transitionEnd.call({ _map: null, _glMap: {} })).toBeUndefined();
  });

  it("still runs the original method while the layer is live", () => {
    const L = makeFakeL();
    guardMaplibreLeaflet(L);
    const proto = (L as unknown as { MaplibreGL: { prototype: Record<string, (this: unknown) => unknown> } }).MaplibreGL.prototype;

    const live = { _map: { getZoom: () => 7 }, _glMap: {} };
    expect(proto._transformGL.call(live)).toBe(7);
  });

  it("_transitionEnd's rAF body no-ops when the layer was torn down (the getZoom race)", () => {
    const L = makeFakeL();
    guardMaplibreLeaflet(L);
    const proto = (L as unknown as { MaplibreGL: { prototype: Record<string, (this: unknown) => unknown> } }).MaplibreGL.prototype;
    // requestAnimFrame runs synchronously in the fake, so this exercises the rAF
    // body — with _map null it must NOT read getZoom() (no throw).
    expect(() => proto._transitionEnd.call({ _map: null, _glMap: {} })).not.toThrow();
  });

  it("_transitionEnd runs the full body while the layer is live", () => {
    const L = makeFakeL();
    guardMaplibreLeaflet(L);
    const proto = (L as unknown as { MaplibreGL: { prototype: Record<string, (this: unknown) => unknown> } }).MaplibreGL.prototype;

    const calls: string[] = [];
    const live = {
      _map: {
        getZoom: () => 5,
        getCenter: () => "center",
        getBounds: () => ({ getNorthWest: () => "nw" }),
        latLngToContainerPoint: () => ({ x: 0, y: 0 }),
      },
      _glMap: {
        _actualCanvas: {},
        once: (ev: string) => calls.push(`once:${ev}`),
        jumpTo: (o: { zoom: number }) => calls.push(`jumpTo:${o.zoom}`),
      },
      _resizeContainer: () => calls.push("resize"),
      _zoomEnd: () => calls.push("zoomEnd"),
    };
    proto._transitionEnd.call(live);
    expect(calls).toContain("resize");
    expect(calls).toContain("once:moveend");
    expect(calls).toContain("jumpTo:4"); // zoom - 1
  });

  it("is idempotent (guarding twice doesn't double-wrap or break)", () => {
    const L = makeFakeL();
    expect(guardMaplibreLeaflet(L)).toBe(true);
    expect(guardMaplibreLeaflet(L)).toBe(true); // already guarded
    const proto = (L as unknown as { MaplibreGL: { prototype: Record<string, (this: unknown) => unknown> } }).MaplibreGL.prototype;
    expect(proto._transformGL.call({ _map: null, _glMap: null })).toBeUndefined();
    expect(proto._transformGL.call({ _map: { getZoom: () => 3 }, _glMap: {} })).toBe(3);
  });
});
