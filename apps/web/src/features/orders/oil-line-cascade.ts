import type { LineItemDraft } from "./orders-create-helpers";

/**
 * Apply one field change to an oil line, cascading resets DOWN the dependency
 * chain brand → segment → product → pack: changing a higher level clears every
 * level below it (a stale product can't belong to the new brand/segment).
 */
export function cascadeLineItem(
  item: LineItemDraft,
  field: keyof LineItemDraft,
  value: string | number,
): LineItemDraft {
  // Brand is the top — clears segment/product/pack.
  if (field === "brand") {
    return { ...item, brand: value as string, segment: "", productId: "", packSizeLitres: 0 };
  }
  // Segment change resets product selection.
  if (field === "segment") {
    return { ...item, segment: value as string, productId: "", packSizeLitres: 0 };
  }
  // Packs are product-specific — clear a stale pack when the product changes.
  if (field === "productId") {
    return { ...item, productId: value as string, packSizeLitres: 0 };
  }
  return { ...item, [field]: value };
}
