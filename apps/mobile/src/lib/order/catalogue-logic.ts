/** Pure derivations for the catalogue "Pick" screen, split out of use-catalogue
 *  so the hook stays small and these stay unit-testable without React. */
import { SEGMENT_ORDER, type Product } from "./types";

/** Segment chips for a brand: the canonical SEGMENT_ORDER first (only those
 *  present), then any extra segments the catalogue carries, in insertion order. */
export function orderSegments(present: Set<string>): string[] {
  const ordered = SEGMENT_ORDER.filter((s) => present.has(s));
  const extras = [...present].filter((s) => !SEGMENT_ORDER.includes(s));
  return [...ordered, ...extras];
}

/** Tapping a product: a no-choice product (one pack, ≤1 segment) goes straight
 *  to the cart at qty 1 → returns its {pack, segment}; anything that needs a
 *  choice returns null → the caller opens the pack sheet. */
export function resolveQuickAdd(
  p: Product,
): { pack: number | null; segment: string | null } | null {
  if (p.unit === "quantity" && p.segments.length <= 1) {
    return { pack: null, segment: p.segments[0] ?? null };
  }
  const packs = p.packSizes ?? [];
  if (p.unit === "litres" && packs.length === 1 && p.segments.length <= 1) {
    return { pack: packs[0], segment: p.segments[0] ?? null };
  }
  return null;
}

/** The pack size a freshly-opened sheet should preselect: none for quantity
 *  products, the remembered pack if it's still offered, else the first pack. */
export function computeDefaultPack(
  product: Product | null,
  remembered: number | undefined,
): number | null {
  const packs = product?.packSizes ?? [];
  if (product?.unit === "quantity") return null;
  if (remembered && packs.includes(remembered)) return remembered;
  return packs[0] ?? 0;
}
