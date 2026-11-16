/**
 * CA export — the GSTR-1 dataset for the Reports → GST Report preview. Fetches
 * the register from `GET /invoices/export`. The .xlsx itself is built server-side
 * (official GSTN template) and downloaded/emailed via `/invoices/gstr1.xlsx` and
 * `/invoices/gstr1/email` — see docs/GSTR1-EXPORT-PLAN.md.
 */
import { apiRequest, type ActionConfig } from "@/lib/api-client";

export interface Gstr1Dataset {
  period: { from: string; to: string };
  seller: { gstin: string; legalName: string; stateCode: string };
  b2b: { invoiceNumber: string; invoiceDate: string; gstin: string; receiver: string; invoiceValue: number; placeOfSupply: string | null; reverseCharge: boolean; rate: number; taxable: number; cgst: number; sgst: number; igst: number }[];
  b2cl: { invoiceNumber: string; invoiceDate: string; invoiceValue: number; placeOfSupply: string | null; rate: number; taxable: number; igst: number }[];
  b2cs: { placeOfSupply: string; supplyType: string; rate: number; taxable: number; cgst: number; sgst: number; igst: number }[];
  cdnr: { noteNumber: string; noteDate: string; gstin: string; receiver: string; noteValue: number; placeOfSupply: string | null; rate: number; taxable: number; cgst: number; sgst: number; igst: number }[];
  cdnur: { noteNumber: string; noteDate: string; urType: string; receiver: string; noteValue: number; placeOfSupply: string | null; rate: number; taxable: number; cgst: number; sgst: number; igst: number }[];
  exemp: { regType: string; supplyType: string; exempted: number }[];
  hsnB2b: { hsnCode: string; uqc: string; rate: number; qty: number; taxable: number; cgst: number; sgst: number; igst: number }[];
  hsnB2c: { hsnCode: string; uqc: string; rate: number; qty: number; taxable: number; cgst: number; sgst: number; igst: number }[];
  docs: { docType: string; firstNo: string | null; lastNo: string | null; issued: number; cancelled: number }[];
  totals: { invoices: number; taxable: number; tax: number };
}

export function fetchInvoiceExport(cfg: ActionConfig, from: string, to: string): Promise<Gstr1Dataset> {
  return apiRequest<Gstr1Dataset>(cfg, "GET", `/invoices/export?from=${from}&to=${to}`);
}
