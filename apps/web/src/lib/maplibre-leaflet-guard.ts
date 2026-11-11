import type * as LType from "leaflet";

/**
 * Null-guard the `@maplibre/maplibre-gl-leaflet` layer against the map-teardown
 * race.
 *
 * When the Leaflet map is removed, the layer's `_map`/`_glMap` become null — but
 * a queued Leaflet event or a `requestAnimationFrame` callback can still fire and
 * read `this._map.getZoom()`, which throws "Cannot read properties of null
 * (reading 'getZoom')". `_update` already guards `!this._map`; the sibling methods
 * that touch `_map`/`_glMap` do not. We wrap those so they no-op once the layer is
 * gone.
 *
 * `_transitionEnd` is the stubborn one: it does NOT touch `_map` synchronously —
 * it schedules a `requestAnimFrame` whose body reads `this._map.getZoom()` on the
 * NEXT frame. Wrapping the method is useless (by the time it ran, `_map` was still
 * alive); the teardown happens between the scheduling and the frame. So we REPLACE
 * `_transitionEnd` with a faithful reimplementation (plugin v0.1.4) that adds a
 * liveness check INSIDE the rAF. (The sibling `moveend → _zoomEnd` deferred reader
 * is already covered because `_zoomEnd` is wrapped below.)
 *
 * The dashboard Customers map and the Live Tracking map (vardhan-maps) use the
 * SAME plugin version, so this shared prototype is patched once and covers both.
 * Idempotent; a no-op until the plugin has registered `L.MaplibreGL`. Returns
 * true once the guard is in place (or already was), false if the plugin has not
 * loaded yet (so a caller can retry).
 */
const GUARDED_METHODS = [
  "_update",
  "_transformGL",
  "_pinchZoom",
  "_animateZoom",
  "_zoomStart",
  "_zoomEnd",
  "_resize",
] as const;

type LayerThis = { _map?: unknown; _glMap?: unknown };
type MaplibreGLCtor = { prototype: Record<string, unknown> & { __nullGuarded?: boolean } };

// The internals `_transitionEnd`'s rAF body touches on the layer instance.
type TransitionThis = {
  _map: {
    getZoom: () => number;
    getCenter: () => unknown;
    getBounds: () => { getNorthWest: () => unknown };
    latLngToContainerPoint: (ll: unknown) => unknown;
  } | null;
  _glMap: { _actualCanvas: unknown; once: (ev: string, cb: () => void) => void; jumpTo: (o: unknown) => void } | null;
  _resizeContainer: () => void;
  _zoomEnd: () => void;
};
type LeafletUtil = {
  Util: {
    requestAnimFrame: (fn: (this: TransitionThis) => void, ctx: TransitionThis) => void;
    bind: (fn: (this: TransitionThis) => void, ctx: TransitionThis) => () => void;
  };
  DomUtil: { setTransform: (el: unknown, offset: unknown, scale: number) => void };
};

export function guardMaplibreLeaflet(L: typeof LType): boolean {
  const proto = (L as unknown as { MaplibreGL?: MaplibreGLCtor }).MaplibreGL?.prototype;
  if (!proto) return false;
  if (proto.__nullGuarded) return true;

  for (const name of GUARDED_METHODS) {
    const orig = proto[name];
    if (typeof orig !== "function") continue;
    const original = orig as (this: LayerThis, ...args: unknown[]) => unknown;
    proto[name] = function (this: LayerThis, ...args: unknown[]) {
      // Layer removed → its map/GL map are null; a stray event or rAF callback
      // must not read getZoom()/getCenter() on a dead map.
      if (!this._map || !this._glMap) return undefined;
      return original.apply(this, args);
    };
  }

  // Replace `_transitionEnd` with the plugin-v0.1.4 body + a rAF-time liveness
  // guard (see the doc comment above for why wrapping isn't enough).
  const lu = L as unknown as LeafletUtil;
  proto._transitionEnd = function (this: TransitionThis) {
    lu.Util.requestAnimFrame(function (this: TransitionThis) {
      // Torn down between the transition ending and this frame → bail.
      if (!this._map || !this._glMap) return;
      const zoom = this._map.getZoom();
      const center = this._map.getCenter();
      const offset = this._map.latLngToContainerPoint(this._map.getBounds().getNorthWest());
      this._resizeContainer();
      lu.DomUtil.setTransform(this._glMap._actualCanvas, offset, 1);
      this._glMap.once("moveend", lu.Util.bind(function (this: TransitionThis) {
        this._zoomEnd();
      }, this));
      this._glMap.jumpTo({ center, zoom: zoom - 1 });
    }, this);
  } as unknown as (typeof proto)["_transitionEnd"];

  proto.__nullGuarded = true;
  return true;
}
