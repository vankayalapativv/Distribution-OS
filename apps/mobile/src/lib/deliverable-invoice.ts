import { openLocationInMaps } from "./open-in-maps";

// A deliverable invoice: order-linked, uploaded, not yet delivered. The driver
// picks one directly — the customer is carried on the invoice, so there is no
// separate customer step.
export interface DeliverableInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  grandTotal: number;
  customerId: string;
  customerName: string | null;
  customerCode: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  /** Customer's saved shop coordinates (set by the SE); may be null. */
  latitude: number | null;
  longitude: number | null;
}

export function addressLine(inv: DeliverableInvoice): string {
  return [inv.addressStreet, inv.addressCity].filter(Boolean).join(", ");
}

/**
 * Open the customer's location in Google Maps: a dropped pin at the saved
 * coordinates when we have them, otherwise a text search of the address (or the
 * customer name) so the driver still gets something useful.
 */
export function openInMaps(inv: DeliverableInvoice): void {
  openLocationInMaps({
    latitude: inv.latitude,
    longitude: inv.longitude,
    address: addressLine(inv) || inv.customerName,
  });
}
