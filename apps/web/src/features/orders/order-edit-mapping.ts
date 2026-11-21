import type { EditableOrder } from "./use-order-draft";

/** The order-detail fields the edit dialog needs (from GET /orders/:id). */
export interface FetchedOrderForEdit {
  id: string;
  customerId: string;
  customerName: string | null;
  salesExecutiveId: string | null;
  orderDate: string | null;
  items: {
    id: string;
    productId: string | null;
    quantityUnits: number;
    packSizeLitres: number | null;
    segment: string | null;
    productName: string | null;
    brand?: string | null;
  }[];
  skuProgress?: { orderItemId: string; invoicedUnits: number; deliveredUnits?: number }[];
}

/** Map a fetched order into the create/edit dialog's shape, merging per-line
 *  billed quantity (skuProgress) so locked (partially-invoiced) lines are known. */
export function mapFetchedToEditable(order: FetchedOrderForEdit): EditableOrder {
  const invoicedByItem = new Map((order.skuProgress ?? []).map((s) => [s.orderItemId, s.invoicedUnits]));
  const deliveredByItem = new Map((order.skuProgress ?? []).map((s) => [s.orderItemId, s.deliveredUnits ?? 0]));
  return {
    id: order.id,
    customerId: order.customerId,
    customerName: order.customerName,
    salesExecutiveId: order.salesExecutiveId,
    orderDate: order.orderDate,
    items: order.items.map((it) => ({
      orderItemId: it.id,
      productId: it.productId,
      quantityUnits: it.quantityUnits,
      packSizeLitres: it.packSizeLitres,
      segment: it.segment,
      brand: it.brand ?? null,
      invoicedUnits: invoicedByItem.get(it.id) ?? 0,
      deliveredUnits: deliveredByItem.get(it.id) ?? 0,
      label: it.productName ?? "Item",
    })),
  };
}
