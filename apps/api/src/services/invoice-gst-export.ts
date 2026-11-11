/**
 * GSTR-1-ready register for the CA (GET /invoices/export). Built from
 * system-GENERATED invoices in a period (they carry the structured CGST/SGST/IGST
 * split + invoice_items). Uploaded/parsed invoices are a different format and are
 * not included here. Sheets: B2B (buyer GSTIN present), B2CS (no GSTIN, summarised
 * by state+rate), HSN summary, and Documents issued.
 */
import type { SqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";
import { dateIso, num, str } from "./stock-shared";

function requireYmd(v: string, field: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new ApiError("INVALID_FIELD", `${field} must be yyyy-mm-dd.`, 422);
  return v;
}

export async function getInvoiceExport(sql: SqlClient, fromRaw: string, toRaw: string) {
  const from = requireYmd(fromRaw, "from");
  const to = requireYmd(toRaw, "to");

  const b2b = await sql`
    /* gst_b2b */
    select invoice_number as "invoiceNumber", invoice_date as "invoiceDate", gst_number as "gstin",
           buyer_state_code as "stateCode", place_of_supply as "placeOfSupply",
           taxable_value as "taxable", cgst_amount as "cgst", sgst_amount as "sgst",
           igst_amount as "igst", invoice_net_value as "total"
    from invoices
    where invoice_source = 'generated' and doc_status = 'final'
      and invoice_date between ${from}::date and ${to}::date
      and gst_number is not null and gst_number <> ''
    order by invoice_number
  `;

  const b2cs = await sql`
    /* gst_b2cs */
    select coalesce(buyer_state_code, '36') as "stateCode",
           sum(taxable_value) as "taxable", sum(cgst_amount) as "cgst",
           sum(sgst_amount) as "sgst", sum(igst_amount) as "igst", count(*) as "invoices"
    from invoices
    where invoice_source = 'generated' and doc_status = 'final'
      and invoice_date between ${from}::date and ${to}::date
      and (gst_number is null or gst_number = '')
    group by coalesce(buyer_state_code, '36')
    order by 1
  `;

  const hsn = await sql`
    /* gst_hsn */
    select ii.hsn_code as "hsnCode", ii.gst_rate as "rate",
           sum(ii.qty_units) as "qty", sum(ii.taxable_amount) as "taxable",
           sum(ii.cgst) as "cgst", sum(ii.sgst) as "sgst", sum(ii.igst) as "igst"
    from invoice_items ii
    join invoices i on i.id = ii.invoice_id
    where i.invoice_source = 'generated' and i.doc_status = 'final'
      and i.invoice_date between ${from}::date and ${to}::date
    group by ii.hsn_code, ii.gst_rate
    order by ii.hsn_code
  `;

  const [docs] = await sql`
    /* gst_docs */
    select count(*) filter (where doc_status <> 'cancelled') as "issued",
           count(*) filter (where doc_status = 'cancelled') as "cancelled",
           min(invoice_number) as "firstNo", max(invoice_number) as "lastNo"
    from invoices
    where invoice_source = 'generated'
      and invoice_date between ${from}::date and ${to}::date
  `;

  const [totals] = await sql`
    /* gst_totals */
    select count(*) as "invoices", coalesce(sum(taxable_value),0) as "taxable",
           coalesce(sum(cgst_amount + sgst_amount + igst_amount),0) as "tax"
    from invoices
    where invoice_source = 'generated' and doc_status = 'final'
      and invoice_date between ${from}::date and ${to}::date
  `;

  return {
    period: { from, to },
    b2b: b2b.map((r) => ({
      invoiceNumber: str(r.invoiceNumber), invoiceDate: dateIso(r.invoiceDate), gstin: str(r.gstin),
      stateCode: str(r.stateCode), placeOfSupply: r.placeOfSupply == null ? null : str(r.placeOfSupply),
      taxable: num(r.taxable), cgst: num(r.cgst), sgst: num(r.sgst), igst: num(r.igst), total: num(r.total),
    })),
    b2cs: b2cs.map((r) => ({
      stateCode: str(r.stateCode), invoices: num(r.invoices),
      taxable: num(r.taxable), cgst: num(r.cgst), sgst: num(r.sgst), igst: num(r.igst),
    })),
    hsn: hsn.map((r) => ({
      hsnCode: str(r.hsnCode), rate: num(r.rate), qty: num(r.qty),
      taxable: num(r.taxable), cgst: num(r.cgst), sgst: num(r.sgst), igst: num(r.igst),
    })),
    docs: {
      issued: num(docs?.issued), cancelled: num(docs?.cancelled),
      firstNo: docs?.firstNo == null ? null : str(docs.firstNo),
      lastNo: docs?.lastNo == null ? null : str(docs.lastNo),
    },
    totals: { invoices: num(totals?.invoices), taxable: num(totals?.taxable), tax: num(totals?.tax) },
  };
}

export type InvoiceExport = Awaited<ReturnType<typeof getInvoiceExport>>;
