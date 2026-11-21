import type { Order } from "./orders-api";

export { mapFetchedToEditable, type FetchedOrderForEdit } from "./order-edit-mapping";

/** "yyyy-MM-dd" → a local Date (avoids the UTC day-shift of `new Date(str)`). */
export function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
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
 *  • partially_returned / returned → Create Invoice too, IF an un-invoiced remainder
 *    is still left (a return never blocks billing the unbilled balance).
 * The real "is there anything to bill" gate is `!fullyInvoiced`; the stage set just
 * excludes the terminal states (delivered/invoiced/cancelled/short-closed).
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
    (stage === "ordered" ||
      stage === "partially_invoiced" ||
      stage === "partially_delivered" ||
      stage === "partially_returned" ||
      stage === "returned");
  const canEdit =
    !cancelled &&
    ((canCreate && stage === "ordered") ||
      ((canCreate || canInvoice) && stage === "partially_delivered"));
  const canCancel = canCreate;
  const canGenerate = invoiceGenerationEnabled && invoiceable;
  const hidden = !canGenerate && !canEdit && !canCancel;
  return { canGenerate, canEdit, canCancel, hidden };
}
