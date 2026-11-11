/** Types for the Invoices feature (list rows come from GET /invoices). */

import { apiRequest, type ActionConfig } from "@/lib/api-client";

/** Cancel a generated invoice (reverses its stock, reopens the order). Requires a
 *  reason; the server re-checks that the invoice is generated and not already
 *  cancelled. SUPER_ADMIN + ACCOUNTANT only. */
export async function cancelInvoice(cfg: ActionConfig, id: string, reason: string): Promise<void> {
  await apiRequest(cfg, "POST", `/invoices/${id}/cancel`, { reason });
}

/**
 * Open an invoice's PDF in a new tab via the same-origin proxy
 * (`/api/invoice-files/:id`), which authenticates with the session cookie. A
 * plain navigation (not fetch + `URL.createObjectURL`) means the tab shows a
 * real URL, never a `blob:` object URL. Passing the invoice number makes the
 * proxy title the browser tab with it (instead of the PDF's "BusyWin" title).
 * Client-only.
 */
export function openInvoicePdf(invoiceId: string, invoiceNumber?: string): void {
  const query = invoiceNumber ? `?name=${encodeURIComponent(invoiceNumber)}` : "";
  window.open(`/api/invoice-files/${invoiceId}${query}`, "_blank", "noopener");
}

export interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  customerId: string;
  customerName: string | null;
  customerCity: string | null;
  orderId: string | null;
  orderCode: string | null;
  salesExecutiveId: string | null;
  salesExecutiveName: string | null;
  station: string | null;
  partyPhone: string | null;
  totalLitres: number;
  taxableValue: number;
  gstAmount: number;
  grandTotal: number;
  amountCollected: number;
  outstandingAmount: number;
  paymentStatus: string;
  invoiceSource?: string | null;
  docStatus?: string | null;
  createdAt: string;
}

export interface CustomerOption {
  id: string;
  legalName: string;
  phone: string | null;
}
