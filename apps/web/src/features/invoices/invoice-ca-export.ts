/**
 * CA export — a GSTR-1-ready .xlsx of the period's generated invoices. Fetches
 * the register from `GET /invoices/export` and builds a multi-sheet workbook
 * (B2B / B2CS / HSN / Docs) with SheetJS, imported at call time.
 */
import { apiRequest, type ActionConfig } from "@/lib/api-client";

export interface InvoiceExport {
  period: { from: string; to: string };
  b2b: { invoiceNumber: string; invoiceDate: string; gstin: string; stateCode: string; placeOfSupply: string | null; taxable: number; cgst: number; sgst: number; igst: number; total: number }[];
  b2cs: { stateCode: string; invoices: number; taxable: number; cgst: number; sgst: number; igst: number }[];
  hsn: { hsnCode: string; rate: number; qty: number; taxable: number; cgst: number; sgst: number; igst: number }[];
  docs: { issued: number; cancelled: number; firstNo: string | null; lastNo: string | null };
  totals: { invoices: number; taxable: number; tax: number };
}

export function fetchInvoiceExport(cfg: ActionConfig, from: string, to: string): Promise<InvoiceExport> {
  return apiRequest<InvoiceExport>(cfg, "GET", `/invoices/export?from=${from}&to=${to}`);
}

export async function downloadCaExport(data: InvoiceExport): Promise<void> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  const b2b = [
    ["Invoice no", "Date", "Buyer GSTIN", "State code", "Place of supply", "Taxable", "CGST", "SGST", "IGST", "Total"],
    ...data.b2b.map((r) => [r.invoiceNumber, r.invoiceDate, r.gstin, r.stateCode, r.placeOfSupply ?? "", r.taxable, r.cgst, r.sgst, r.igst, r.total]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(b2b), "B2B");

  const b2cs = [
    ["State code", "Invoices", "Taxable", "CGST", "SGST", "IGST"],
    ...data.b2cs.map((r) => [r.stateCode, r.invoices, r.taxable, r.cgst, r.sgst, r.igst]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(b2cs), "B2CS");

  const hsn = [
    ["HSN", "Rate %", "Qty (units)", "Taxable", "CGST", "SGST", "IGST"],
    ...data.hsn.map((r) => [r.hsnCode, r.rate, r.qty, r.taxable, r.cgst, r.sgst, r.igst]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hsn), "HSN summary");

  const docsAoa = [
    ["Documents issued", ""],
    ["Period", `${data.period.from} to ${data.period.to}`],
    ["Invoices issued", data.docs.issued],
    ["Cancelled", data.docs.cancelled],
    ["First number", data.docs.firstNo ?? "—"],
    ["Last number", data.docs.lastNo ?? "—"],
    ["", ""],
    ["Total taxable", data.totals.taxable],
    ["Total tax", data.totals.tax],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(docsAoa), "Docs");

  XLSX.writeFile(wb, `sri-aparajita-gstr1-${data.period.from}_${data.period.to}.xlsx`);
}
