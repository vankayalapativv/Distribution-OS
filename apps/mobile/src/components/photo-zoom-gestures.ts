import { Gesture } from "react-native-gesture-handler";
import { withTiming, type SharedValue } from "react-native-reanimated";

export const MAX_SCALE = 5;

/** The six shared values that drive the zoom/pan transform. */
export interface ZoomValues {
  scale: SharedValue<number>;
  savedScale: SharedValue<number>;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  savedTx: SharedValue<number>;
  savedTy: SharedValue<number>;
}

/** New scale from a pinch, clamped to [1, MAX_SCALE]. */
export function clampScale(saved: number, factor: number): number {
  return Math.min(Math.max(saved * factor, 1), MAX_SCALE);
}

/** Back to 1×, centered. */
export function resetZoom(v: ZoomValues): void {
  v.scale.value = withTiming(1);
  v.savedScale.value = 1;
  v.tx.value = withTiming(0);
  v.ty.value = withTiming(0);
  v.savedTx.value = 0;
  v.savedTy.value = 0;
}

export function onPinchUpdate(v: ZoomValues, e: { scale: number }): void {
  v.scale.value = clampScale(v.savedScale.value, e.scale);
}
export function onPinchEnd(v: ZoomValues): void {
  v.savedScale.value = v.scale.value;
  if (v.scale.value <= 1) resetZoom(v);
}

export function onPanUpdate(v: ZoomValues, e: { translationX: number; translationY: number }): void {
  if (v.scale.value > 1) {
    v.tx.value = v.savedTx.value + e.translationX;
    v.ty.value = v.savedTy.value + e.translationY;
  }
}
export function onPanEnd(v: ZoomValues): void {
  v.savedTx.value = v.tx.value;
  v.savedTy.value = v.ty.value;
}

/** Double-tap toggles between 1× and 2×. */
export function onDoubleTap(v: ZoomValues): void {
  if (v.scale.value > 1) {
    resetZoom(v);
  } else {
    v.scale.value = withTiming(2);
    v.savedScale.value = 2;
  }
}

/** Wire the pinch / pan / double-tap gestures into one composed gesture. */
export function buildZoomGestures(v: ZoomValues) {
  const pinch = Gesture.Pinch()
    .onUpdate((e: { scale: number }) => onPinchUpdate(v, e))
    .onEnd(() => onPinchEnd(v));
  const pan = Gesture.Pan()
    .onUpdate((e: { translationX: number; translationY: number }) => onPanUpdate(v, e))
    .onEnd(() => onPanEnd(v));
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => onDoubleTap(v));
  return Gesture.Simultaneous(Gesture.Race(doubleTap, pan), pinch);
}
