import type { EditableOrder, LockedLine } from "./order-draft-types";
import type { LineItemDraft } from "./orders-create-helpers";

/** A line is "locked" once any of its units are already invoiced (partial delivery). */
export const isLocked = (i: EditableOrder["items"][number]): boolean => (i.invoicedUnits ?? 0) > 0;

/** Seed the oil grid from the order's UN-invoiced oil lines. */
export function seedOilLines(order: EditableOrder): LineItemDraft[] {
  return order.items
    .filter((i) => i.productId && !isLocked(i))
    .map((i) => ({
      uid: crypto.randomUUID(),
      segment: i.segment ?? "",
      productId: i.productId!,
      packSizeLitres: i.packSizeLitres ?? 0,
      quantityUnits: i.quantityUnits,
    }));
}

/** Seed the locked (already-invoiced) lines shown in the quantity-only editor. */
export function seedLockedLines(order: EditableOrder): LockedLine[] {
  return order.items.filter(isLocked).map((i) => ({
    orderItemId: i.orderItemId ?? "",
    label: i.label ?? "Item",
    invoicedUnits: i.invoicedUnits!, // isLocked guarantees > 0
    quantityUnits: String(i.quantityUnits),
  }));
}
