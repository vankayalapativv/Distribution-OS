import type { OrderItem } from "./orders-api";

/** Original ordered figures for a line. A short-close shrinks the live qty down to
 *  the invoiced amount, so the original = live qty + the cancelled remainder. */
export function itemOriginal(
  item: OrderItem,
  cancelledUnits: number,
): { originalQty: number; originalLitres: number | null } {
  const originalLitres =
    item.totalLitres != null ? item.totalLitres + (item.packSizeLitres ?? 0) * cancelledUnits : null;
  return { originalQty: item.quantityUnits + cancelledUnits, originalLitres };
}
