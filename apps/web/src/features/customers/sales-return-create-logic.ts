import type { ReturnLine } from "./sales-return-edit-logic";

export interface OutstandingInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  outstandingAmount: number;
}

/** A billed line that can be returned (superset of the edit's ReturnLine). */
export interface ReturnableLine extends ReturnLine {
  packLitresPerUnit: number | null;
  billedUnits: number;
  returnedUnits: number;
}

export interface ReturnableResponse {
  invoice: { id: string; invoiceNumber: string; invoiceDate: string; outstandingAmount: number };
  lines: ReturnableLine[];
}

export const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/** Multipart POST /sales-returns body for a new return. */
export function createReturnFormData(opts: {
  customerId: string;
  invoiceId: string;
  date: string;
  items: { orderItemId: string; quantityUnits: number }[];
  reason: string;
  proofFile: File | null;
}): FormData {
  const body = new FormData();
  body.append("customerId", opts.customerId);
  body.append("invoiceId", opts.invoiceId);
  body.append("returnDate", opts.date);
  body.append("items", JSON.stringify(opts.items));
  if (opts.reason.trim()) body.append("reason", opts.reason.trim());
  if (opts.proofFile) body.append("file", opts.proofFile);
  return body;
}
