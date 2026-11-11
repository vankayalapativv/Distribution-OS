import type { EditableOrder } from "./use-order-draft";
import type { Order } from "./orders-api";

/** "yyyy-MM-dd" → a local Date (avoids the UTC day-shift of `new Date(str)`). */
export function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

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
  }[];
  skuProgress?: { orderItemId: string; invoicedUnits: number }[];
}

/** Map a fetched order into the create/edit dialog's shape, merging per-line
 *  billed quantity (skuProgress) so locked (partially-invoiced) lines are known. */
export function mapFetchedToEditable(order: FetchedOrderForEdit): EditableOrder {
  const invoicedByItem = new Map(
    (order.skuProgress ?? []).map((s) => [s.orderItemId, s.invoicedUnits]),
  );
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
      invoicedUnits: invoicedByItem.get(it.id) ?? 0,
      label: it.productName ?? "Item",
    })),
  };
}

export interface OrderActionFlags {
  canGenerate: boolean;
  canEdit: boolean;
  canCancel: boolean;
  /** True when no action applies at all → render nothing for the row. */
  hidden: boolean;
}

/**
 * Per-fulfillment-stage action availability for a row's ⋮ menu (pure):
 *  • delivered (non-cancelled) → nothing (final).
 *  • ordered → Create Invoice + full edit + cancel.
 *  • partially_delivered → Create Invoice + remainder-edit (SA/Manager/Accountant) + cancel.
 *  • invoiced → cancel only. Invoicing stops once fully invoiced.
 */
export function orderActionFlags(
  o: Order,
  opts: { canCreate: boolean; canInvoice: boolean; invoiceGenerationEnabled: boolean },
): OrderActionFlags {
  const { canCreate, canInvoice, invoiceGenerationEnabled } = opts;
  const cancelled = o.orderStatus === "cancelled";
  const stage = o.fulfillmentStatus ?? "ordered";
  if (stage === "delivered" && !cancelled) {
    return { canGenerate: false, canEdit: false, canCancel: false, hidden: true };
  }
  // The order is still open enough to invoice (role-gated, not fully billed).
  const invoiceable =
    !cancelled &&
    canInvoice &&
    !o.fullyInvoiced &&
    (stage === "ordered" || stage === "partially_invoiced" || stage === "partially_delivered");
  const canEdit =
    !cancelled &&
    ((canCreate && stage === "ordered") ||
      ((canCreate || canInvoice) && stage === "partially_delivered"));
  const canCancel = canCreate;
  const canGenerate = invoiceGenerationEnabled && invoiceable;
  const hidden = !canGenerate && !canEdit && !canCancel;
  return { canGenerate, canEdit, canCancel, hidden };
}
