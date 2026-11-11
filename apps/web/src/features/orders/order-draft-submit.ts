import { format } from "date-fns";
import { isQuantityProduct, type LineItemDraft } from "./orders-create-helpers";
import type { LockedLine } from "./order-draft-types";
import type { Product } from "./orders-api";

/** Keep only the fully-specified oil lines. A litres product needs a pack size;
 *  a quantity product just needs to be picked. A positive quantity is required —
 *  a blank/zero/negative qty line is dropped so it's never submitted. */
export function collectDraftItems(oilItems: LineItemDraft[], products: Product[]) {
  return {
    validItems: oilItems.filter(
      (i) =>
        i.productId &&
        i.quantityUnits > 0 &&
        (isQuantityProduct(i.productId, products) || i.packSizeLitres > 0),
    ),
  };
}

export interface DraftValidation {
  validItems: LineItemDraft[];
  lockedLines: LockedLine[];
}

/** First blocking validation message for the draft, or null when it's ready. */
export function validateDraft(a: DraftValidation): string | null {
  if (a.validItems.length === 0 && a.lockedLines.length === 0) {
    return "Add at least one oil line item.";
  }
  for (const l of a.lockedLines) {
    const qty = Number(l.quantityUnits);
    if (!Number.isInteger(qty) || qty < l.invoicedUnits) {
      return `${l.label}: quantity must be a whole number of at least ${l.invoicedUnits} (already billed).`;
    }
  }
  return null;
}

export interface PayloadInput {
  selectedCustomerId: string;
  selectedSalesExecId: string;
  orderDate: Date | undefined;
  validItems: LineItemDraft[];
  lockedLines: LockedLine[];
  products: Product[];
}

/** The create/update request body: new oil lines plus locked lines (id + new
 *  quantity only — the API updates them in place and protects billing).
 *  Quantity products send a null pack size. */
export function buildOrderPayload(a: PayloadInput) {
  return {
    customerId: a.selectedCustomerId,
    salesExecutiveId: a.selectedSalesExecId || null,
    orderDate: a.orderDate ? format(a.orderDate, "yyyy-MM-dd") : null,
    items: [
      ...a.validItems.map((i) => ({
        segment: i.segment || null,
        productId: i.productId,
        packSizeLitres: isQuantityProduct(i.productId, a.products) ? null : i.packSizeLitres,
        quantityUnits: i.quantityUnits,
      })),
      ...a.lockedLines.map((l) => ({ orderItemId: l.orderItemId, quantityUnits: Number(l.quantityUnits) })),
    ],
  };
}
