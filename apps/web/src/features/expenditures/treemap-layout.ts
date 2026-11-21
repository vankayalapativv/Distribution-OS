import type { Slice } from "./breakdown-slices";

/** Fixed treemap height (px); width is measured from the container. */
export const HEIGHT = 300;

/** A placed slice: its rectangle in the treemap. */
export interface Tile extends Slice {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Binary-split (slice-and-dice) treemap. Each call lays `items` into the rect
 * (x, y, w, h), splitting along the longer axis at the greedy half-weight point,
 * then recursing on both sides until a single item fills its rectangle (leaf).
 *
 * The half-weight break can land past the last item (e.g. equal amounts never
 * cross half strictly); the guard clamps it so neither side is ever empty —
 * an empty side would recurse on the same array forever.
 */
export function layout(items: Slice[], x: number, y: number, w: number, h: number, out: Tile[]): void {
  if (items.length === 1) {
    out.push({ ...items[0], x, y, w, h });
    return;
  }
  const total = items.reduce((sum, it) => sum + it.amount, 0);

  let acc = 0;
  let k = 0;
  for (k = 0; k < items.length; k++) {
    acc += items[k].amount;
    if (acc * 2 > total) break;
  }
  if (k >= items.length - 1) k = items.length - 2; // keep both sides non-empty

  const left = items.slice(0, k + 1);
  const right = items.slice(k + 1);
  const leftSum = left.reduce((sum, it) => sum + it.amount, 0);
  const frac = leftSum / total;

  if (w >= h) {
    const wl = w * frac;
    layout(left, x, y, wl, h, out);
    layout(right, x + wl, y, w - wl, h, out);
  } else {
    const hl = h * frac;
    layout(left, x, y, w, hl, out);
    layout(right, x, y + hl, w, h - hl, out);
  }
}

/** Readable text colour (dark slate or white) for a solid hex `fill`, by luminance. */
export function textColor(fill: string): string {
  const r = parseInt(fill.slice(1, 3), 16);
  const g = parseInt(fill.slice(3, 5), 16);
  const b = parseInt(fill.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? "#0f172a" : "#ffffff";
}

/** A tile too small to carry its amount line comfortably. */
export function isTight(w: number, h: number): boolean {
  return w < 70 || h < 40;
}

/** `amount` as a whole-percent share of `total` (0 when the total is 0). */
export function share(amount: number, total: number): number {
  return total > 0 ? Math.round((amount / total) * 100) : 0;
}
