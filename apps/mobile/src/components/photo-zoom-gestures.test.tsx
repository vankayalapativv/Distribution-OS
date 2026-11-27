import { describe, expect, it } from "vitest";
import {
  buildZoomGestures,
  clampScale,
  MAX_SCALE,
  onDoubleTap,
  onPanEnd,
  onPanUpdate,
  onPinchEnd,
  onPinchUpdate,
  resetZoom,
  type ZoomValues,
} from "./photo-zoom-gestures";

const vals = (over: Partial<Record<keyof ZoomValues, number>> = {}): ZoomValues =>
  ({
    scale: { value: over.scale ?? 1 },
    savedScale: { value: over.savedScale ?? 1 },
    tx: { value: over.tx ?? 0 },
    ty: { value: over.ty ?? 0 },
    savedTx: { value: over.savedTx ?? 0 },
    savedTy: { value: over.savedTy ?? 0 },
  }) as ZoomValues;

describe("clampScale", () => {
  it("clamps to [1, MAX_SCALE]", () => {
    expect(clampScale(2, 1.5)).toBe(3);
    expect(clampScale(1, 0.1)).toBe(1); // floor
    expect(clampScale(3, 10)).toBe(MAX_SCALE); // ceiling
  });
});

describe("pinch", () => {
  it("updates scale from the saved base", () => {
    const v = vals({ savedScale: 2 });
    onPinchUpdate(v, { scale: 1.5 });
    expect(v.scale.value).toBe(3);
  });

  it("commits the scale on end, resetting when it falls to ≤1", () => {
    const zoomed = vals({ scale: 2.5 });
    onPinchEnd(zoomed);
    expect(zoomed.savedScale.value).toBe(2.5);
    const collapsed = vals({ scale: 0.8, tx: 40 });
    onPinchEnd(collapsed);
    expect(collapsed.scale.value).toBe(1); // reset
    expect(collapsed.tx.value).toBe(0);
  });
});

describe("pan", () => {
  it("moves only while zoomed in", () => {
    const zoomed = vals({ scale: 2, savedTx: 5, savedTy: 10 });
    onPanUpdate(zoomed, { translationX: 3, translationY: -4 });
    expect(zoomed.tx.value).toBe(8);
    expect(zoomed.ty.value).toBe(6);
    const flat = vals({ scale: 1 });
    onPanUpdate(flat, { translationX: 100, translationY: 100 });
    expect(flat.tx.value).toBe(0); // ignored at 1×
  });

  it("commits the pan offset on end", () => {
    const v = vals({ tx: 12, ty: -7 });
    onPanEnd(v);
    expect(v.savedTx.value).toBe(12);
    expect(v.savedTy.value).toBe(-7);
  });
});

describe("doubleTap", () => {
  it("zooms to 2× from 1×, and resets when already zoomed", () => {
    const flat = vals({ scale: 1 });
    onDoubleTap(flat);
    expect(flat.scale.value).toBe(2);
    expect(flat.savedScale.value).toBe(2);
    const zoomed = vals({ scale: 3, tx: 50 });
    onDoubleTap(zoomed);
    expect(zoomed.scale.value).toBe(1); // reset
    expect(zoomed.tx.value).toBe(0);
  });
});

describe("resetZoom + buildZoomGestures wiring", () => {
  it("resetZoom returns everything to the origin", () => {
    const v = vals({ scale: 4, savedScale: 4, tx: 20, ty: 20, savedTx: 20, savedTy: 20 });
    resetZoom(v);
    expect([v.scale.value, v.savedScale.value, v.tx.value, v.ty.value, v.savedTx.value, v.savedTy.value]).toEqual([
      1, 1, 0, 0, 0, 0,
    ]);
  });

  it("wires each gesture's callbacks to the handlers", () => {
    const v = vals({ scale: 2, savedScale: 2 });
    const composed = buildZoomGestures(v) as unknown as { _children: [{ _children: [any, any] }, any] };
    const [race, pinch] = composed._children;
    const [doubleTap, pan] = race._children;
    // pinch
    pinch._cbs.update({ scale: 1 });
    expect(v.scale.value).toBe(2);
    pinch._cbs.end();
    // pan (zoomed → moves)
    pan._cbs.update({ translationX: 1, translationY: 1 });
    expect(v.tx.value).toBe(1);
    pan._cbs.end();
    // double tap (zoomed → resets)
    doubleTap._cbs.end();
    expect(v.scale.value).toBe(1);
  });
});
