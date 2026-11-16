/**
 * GSTR-1 dataset for the CA (GET /invoices/export → the .xlsx + email-to-CA).
 *
 * Built from system-GENERATED, FINAL invoices in a period (they carry the
 * structured CGST/SGST/IGST split + per-line invoice_items). Uploaded/parsed
 * invoices are a different format and are deliberately excluded. Everything here
 * is enterprise-scoped automatically by the RLS GUC (app.enterprise_id) — no
 * explicit enterprise filter needed.
 *
 * Sections mirror the official GSTN GSTR-1 Excel template:
 *   b2b     — registered buyers (GSTIN present), one row per invoice × rate
 *   b2cl    — inter-state B2C, invoice value > ₹2,50,000, invoice × rate
 *   b2cs    — other unregistered, consolidated by POS + rate + supply type
 *   cdnr    — credit notes to registered buyers (from sales_returns)
 *   cdnur   — credit notes to unregistered buyers
 *   exemp   — nil / exempt / non-GST outward supplies (rate = 0)
 *   hsnB2b  — HSN summary for B2B supplies   (+ UQC)
 *   hsnB2c  — HSN summary for B2C supplies   (+ UQC)
 *   docs    — document ranges issued (invoices + credit notes), with cancelled
 *   totals  — reconciliation (taxable + tax)
 *
 * Tax split rule: intra-state → CGST + SGST, inter-state → IGST. We read the
 * stored split on invoice lines; for credit notes (no stored split) we derive it
 * from the original line's gst_rate and the original invoice's supply type.
 *
 * supply_type is nullable, so intra/inter is always taken as
 * `coalesce(supply_type, buyer-state vs seller-state)` — used identically for
 * the B2CL/B2CS split AND the credit-note tax split, so a NULL never silently
 * drops a supply or zeroes its tax.
 */
import type { SqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";
import { dateIso, num, str } from "./stock-shared";

/** GSTN B2CL cutoff: inter-state B2C invoices above this value are listed
 *  invoice-wise; the rest are consolidated into B2CS. */
const B2CL_MIN_VALUE = 250000;

/** Enterprise-wide default unit code for the HSN sheets until a per-product UQC
 *  column exists (decision 2026-11-16). Phase 3 makes this configurable per
 *  enterprise in Settings. VKR's filed template used BOX-BOX throughout. */
const DEFAULT_UQC = "BOX-BOX";

function requireYmd(v: string, field: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new ApiError("INVALID_FIELD", `${field} must be yyyy-mm-dd.`, 422);
  return v;
}

export async function getGstr1Dataset(sql: SqlClient, fromRaw: string, toRaw: string) {
  const from = requireYmd(fromRaw, "from");
  const to = requireYmd(toRaw, "to");

  // Seller identity drives the template header + the intra/inter fallback. The
  // numeric GST state code is the GSTIN's first two digits (enterprises stores
  // no separate state code). RLS scopes this to the caller's one enterprise.
  // Awaited first because the state code feeds the queries below.
  const [seller] = await sql`
    /* gst_seller */
    select gstin, legal_name as "legalName", substring(gstin from 1 for 2) as "stateCode"
    from enterprises
    where id = public.app_current_enterprise_id()
  `;
  const sellerStateCode = seller?.stateCode == null ? "" : str(seller.stateCode);

  // B2B — registered buyers, one row per invoice × rate (a multi-rate invoice
  // yields several rows, as GSTN expects). Exempt (rate 0) lines go to `exemp`.
  const b2bP = sql`
    /* gst_b2b */
    select i.invoice_number as "invoiceNumber", to_char(i.invoice_date, 'YYYY-MM-DD') as "invoiceDate",
           i.gst_number as "gstin", c.customer_name as "receiver",
           i.invoice_net_value as "invoiceValue",
           coalesce(i.buyer_state_code, i.place_of_supply) as "placeOfSupply",
           i.reverse_charge as "reverseCharge", ii.gst_rate as "rate",
           sum(ii.taxable_amount) as "taxable",
           sum(ii.cgst) as "cgst", sum(ii.sgst) as "sgst", sum(ii.igst) as "igst"
    from invoices i
    join invoice_items ii on ii.invoice_id = i.id
    left join customers c on c.id = i.customer_id
    where i.invoice_source = 'generated' and i.doc_status = 'final'
      and i.invoice_date between ${from}::date and ${to}::date
      and i.gst_number is not null and i.gst_number <> ''
      and ii.gst_rate > 0
    group by i.id, i.invoice_number, i.invoice_date, i.gst_number, c.customer_name,
             i.invoice_net_value, i.place_of_supply, i.buyer_state_code, i.reverse_charge, ii.gst_rate
    order by i.invoice_number, ii.gst_rate
  `;

  // B2CL — unregistered, inter-state, invoice value over the cutoff; invoice ×
  // rate. "inter" is the derived supply type (stored, else buyer-vs-seller state).
  const b2clP = sql`
    /* gst_b2cl */
    select i.invoice_number as "invoiceNumber", to_char(i.invoice_date, 'YYYY-MM-DD') as "invoiceDate",
           i.invoice_net_value as "invoiceValue",
           coalesce(i.buyer_state_code, i.place_of_supply) as "placeOfSupply",
           ii.gst_rate as "rate",
           sum(ii.taxable_amount) as "taxable", sum(ii.igst) as "igst"
    from invoices i
    join invoice_items ii on ii.invoice_id = i.id
    where i.invoice_source = 'generated' and i.doc_status = 'final'
      and i.invoice_date between ${from}::date and ${to}::date
      and (i.gst_number is null or i.gst_number = '')
      and coalesce(i.supply_type, case when coalesce(i.buyer_state_code, '') = ${sellerStateCode} then 'intra' else 'inter' end) = 'inter'
      and i.invoice_net_value > ${B2CL_MIN_VALUE}
      and ii.gst_rate > 0
    group by i.id, i.invoice_number, i.invoice_date, i.invoice_net_value,
             i.place_of_supply, i.buyer_state_code, ii.gst_rate
    order by i.invoice_number, ii.gst_rate
  `;

  // B2CS — all other unregistered supplies, consolidated by POS + rate + supply
  // type. Excludes the B2CL rows above using the SAME derived supply type, so a
  // NULL supply_type is never dropped from both sheets.
  const b2csP = sql`
    /* gst_b2cs */
    select coalesce(i.buyer_state_code, i.place_of_supply, '36') as "placeOfSupply",
           coalesce(i.supply_type,
             case when coalesce(i.buyer_state_code, '') = ${sellerStateCode} then 'intra' else 'inter' end
           ) as "supplyType",
           ii.gst_rate as "rate",
           sum(ii.taxable_amount) as "taxable", sum(ii.cgst) as "cgst",
           sum(ii.sgst) as "sgst", sum(ii.igst) as "igst"
    from invoices i
    join invoice_items ii on ii.invoice_id = i.id
    where i.invoice_source = 'generated' and i.doc_status = 'final'
      and i.invoice_date between ${from}::date and ${to}::date
      and (i.gst_number is null or i.gst_number = '')
      and not (coalesce(i.supply_type, case when coalesce(i.buyer_state_code, '') = ${sellerStateCode} then 'intra' else 'inter' end) = 'inter'
               and i.invoice_net_value > ${B2CL_MIN_VALUE})
      and ii.gst_rate > 0
    group by 1, 2, 3
    order by 1, 3
  `;

  // Credit notes share ONE numbering sequence across CDNR + CDNUR: both CTEs
  // row_number() over EVERY return in the period (not the reg/unreg subset), so
  // note numbers are unique across both sheets and line up with the docs range.
  // GAP: synthesized CN/YYYYMM/#### until a real credit-note series exists.

  // CDNR — credit notes to registered buyers. sales_returns (header note value)
  // joined to the ORIGINAL invoice for GSTIN/POS/supply type, and to invoice_items
  // (via order_item_id) to recover each line's rate. Tax split is derived from the
  // original invoice's supply type (stored, else buyer-vs-seller state).
  const cdnrP = sql`
    /* gst_cdnr */
    with notes as (
      select sr.id,
             'CN/' || to_char(sr.return_date, 'YYYYMM') || '/' ||
               lpad((row_number() over (order by sr.return_date, sr.id))::text, 4, '0') as "noteNumber"
      from sales_returns sr
      where sr.return_date between ${from}::date and ${to}::date
    )
    select n."noteNumber", to_char(sr.return_date, 'YYYY-MM-DD') as "noteDate", oi.gst_number as "gstin",
           c.customer_name as "receiver", sr.gross_amount as "noteValue",
           coalesce(oi.buyer_state_code, oi.place_of_supply) as "placeOfSupply",
           ii.gst_rate as "rate",
           sum(sri.taxable_amount) as "taxable",
           case when coalesce(oi.supply_type, case when coalesce(oi.buyer_state_code, '') = ${sellerStateCode} then 'intra' else 'inter' end) = 'intra'
                then round(sum(sri.taxable_amount) * ii.gst_rate / 200, 2) else 0 end as "cgst",
           case when coalesce(oi.supply_type, case when coalesce(oi.buyer_state_code, '') = ${sellerStateCode} then 'intra' else 'inter' end) = 'intra'
                then round(sum(sri.taxable_amount) * ii.gst_rate / 200, 2) else 0 end as "sgst",
           case when coalesce(oi.supply_type, case when coalesce(oi.buyer_state_code, '') = ${sellerStateCode} then 'intra' else 'inter' end) = 'inter'
                then round(sum(sri.taxable_amount) * ii.gst_rate / 100, 2) else 0 end as "igst"
    from sales_returns sr
    join notes n on n.id = sr.id
    join invoices oi on oi.id = sr.invoice_id
    join sales_return_items sri on sri.sales_return_id = sr.id
    join invoice_items ii on ii.order_item_id = sri.order_item_id and ii.invoice_id = sr.invoice_id
    left join customers c on c.id = sr.customer_id
    where oi.gst_number is not null and oi.gst_number <> ''
    group by n."noteNumber", sr.return_date, oi.gst_number, c.customer_name,
             sr.gross_amount, oi.place_of_supply, oi.buyer_state_code, oi.supply_type, ii.gst_rate
    order by n."noteNumber", ii.gst_rate
  `;

  // CDNUR — credit notes to unregistered buyers (UR type defaults to B2CL).
  const cdnurP = sql`
    /* gst_cdnur */
    with notes as (
      select sr.id,
             'CN/' || to_char(sr.return_date, 'YYYYMM') || '/' ||
               lpad((row_number() over (order by sr.return_date, sr.id))::text, 4, '0') as "noteNumber"
      from sales_returns sr
      where sr.return_date between ${from}::date and ${to}::date
    )
    select n."noteNumber", to_char(sr.return_date, 'YYYY-MM-DD') as "noteDate",
           c.customer_name as "receiver", sr.gross_amount as "noteValue",
           coalesce(oi.buyer_state_code, oi.place_of_supply) as "placeOfSupply",
           ii.gst_rate as "rate",
           sum(sri.taxable_amount) as "taxable",
           case when coalesce(oi.supply_type, case when coalesce(oi.buyer_state_code, '') = ${sellerStateCode} then 'intra' else 'inter' end) = 'intra'
                then round(sum(sri.taxable_amount) * ii.gst_rate / 200, 2) else 0 end as "cgst",
           case when coalesce(oi.supply_type, case when coalesce(oi.buyer_state_code, '') = ${sellerStateCode} then 'intra' else 'inter' end) = 'intra'
                then round(sum(sri.taxable_amount) * ii.gst_rate / 200, 2) else 0 end as "sgst",
           case when coalesce(oi.supply_type, case when coalesce(oi.buyer_state_code, '') = ${sellerStateCode} then 'intra' else 'inter' end) = 'inter'
                then round(sum(sri.taxable_amount) * ii.gst_rate / 100, 2) else 0 end as "igst"
    from sales_returns sr
    join notes n on n.id = sr.id
    join invoices oi on oi.id = sr.invoice_id
    join sales_return_items sri on sri.sales_return_id = sr.id
    join invoice_items ii on ii.order_item_id = sri.order_item_id and ii.invoice_id = sr.invoice_id
    left join customers c on c.id = sr.customer_id
    where oi.gst_number is null or oi.gst_number = ''
    group by n."noteNumber", sr.return_date, c.customer_name, sr.gross_amount,
             oi.place_of_supply, oi.buyer_state_code, oi.supply_type, ii.gst_rate
    order by n."noteNumber", ii.gst_rate
  `;

  // EXEMP — nil / exempt / non-GST (rate 0) outward supplies, in the four GSTN
  // buckets (registered/unregistered × intra/inter). We can't tell nil from
  // exempt from non-GST without a flag, so the value lands in "exempted". GAP.
  const exempP = sql`
    /* gst_exemp */
    select case when i.gst_number is not null and i.gst_number <> '' then 'reg' else 'unreg' end as "regType",
           coalesce(i.supply_type,
             case when coalesce(i.buyer_state_code, '') = ${sellerStateCode} then 'intra' else 'inter' end
           ) as "supplyType",
           sum(ii.taxable_amount) as "exempted"
    from invoices i
    join invoice_items ii on ii.invoice_id = i.id
    where i.invoice_source = 'generated' and i.doc_status = 'final'
      and i.invoice_date between ${from}::date and ${to}::date
      and ii.gst_rate = 0
    group by 1, 2
    order by 1, 2
  `;

  // HSN — split B2B vs B2C, as the template has two HSN sheets. Qty + taxable +
  // tax per HSN × rate, with the enterprise default UQC.
  const hsnB2bP = sql`
    /* gst_hsn_b2b */
    select ii.hsn_code as "hsnCode", ii.gst_rate as "rate", sum(ii.qty_units) as "qty",
           sum(ii.taxable_amount) as "taxable", sum(ii.cgst) as "cgst",
           sum(ii.sgst) as "sgst", sum(ii.igst) as "igst"
    from invoice_items ii
    join invoices i on i.id = ii.invoice_id
    where i.invoice_source = 'generated' and i.doc_status = 'final'
      and i.invoice_date between ${from}::date and ${to}::date
      and i.gst_number is not null and i.gst_number <> ''
    group by ii.hsn_code, ii.gst_rate
    order by ii.hsn_code
  `;
  const hsnB2cP = sql`
    /* gst_hsn_b2c */
    select ii.hsn_code as "hsnCode", ii.gst_rate as "rate", sum(ii.qty_units) as "qty",
           sum(ii.taxable_amount) as "taxable", sum(ii.cgst) as "cgst",
           sum(ii.sgst) as "sgst", sum(ii.igst) as "igst"
    from invoice_items ii
    join invoices i on i.id = ii.invoice_id
    where i.invoice_source = 'generated' and i.doc_status = 'final'
      and i.invoice_date between ${from}::date and ${to}::date
      and (i.gst_number is null or i.gst_number = '')
    group by ii.hsn_code, ii.gst_rate
    order by ii.hsn_code
  `;

  // DOCS — document ranges issued. Invoices and credit notes are separate GSTN
  // document types. Credit-note numbers are synthesized, so their range is the
  // synthesized span (0001..count, one sequence across both CDNR + CDNUR).
  const docInvP = sql`
    /* gst_docs_inv */
    select count(*) filter (where doc_status <> 'cancelled') as "issued",
           count(*) filter (where doc_status = 'cancelled') as "cancelled",
           min(invoice_number) as "firstNo", max(invoice_number) as "lastNo"
    from invoices
    where invoice_source = 'generated'
      and invoice_date between ${from}::date and ${to}::date
  `;
  const docCnP = sql`
    /* gst_docs_cn */
    select count(*) as "issued",
           'CN/' || to_char(min(return_date), 'YYYYMM') || '/0001' as "firstNo",
           'CN/' || to_char(max(return_date), 'YYYYMM') || '/' ||
             lpad(count(*)::text, 4, '0') as "lastNo"
    from sales_returns
    where return_date between ${from}::date and ${to}::date
  `;

  const totalsP = sql`
    /* gst_totals */
    select count(*) as "invoices", coalesce(sum(taxable_value), 0) as "taxable",
           coalesce(sum(cgst_amount + sgst_amount + igst_amount), 0) as "tax"
    from invoices
    where invoice_source = 'generated' and doc_status = 'final'
      and invoice_date between ${from}::date and ${to}::date
  `;

  // The section queries are independent — run them as one parallel batch (each is
  // its own Neon round-trip) rather than paying ~11× sequential latency.
  const [b2b, b2cl, b2cs, cdnr, cdnur, exemp, hsnB2b, hsnB2c, docInvRows, docCnRows, totalsRows] =
    await Promise.all([b2bP, b2clP, b2csP, cdnrP, cdnurP, exempP, hsnB2bP, hsnB2cP, docInvP, docCnP, totalsP]);
  const docInv = docInvRows[0];
  const docCn = docCnRows[0];
  const totals = totalsRows[0];

  return {
    period: { from, to },
    seller: {
      gstin: seller?.gstin == null ? "" : str(seller.gstin),
      legalName: seller?.legalName == null ? "" : str(seller.legalName),
      stateCode: sellerStateCode,
    },
    b2b: b2b.map((r) => ({
      invoiceNumber: str(r.invoiceNumber), invoiceDate: dateIso(r.invoiceDate), gstin: str(r.gstin),
      receiver: r.receiver == null ? "" : str(r.receiver), invoiceValue: num(r.invoiceValue),
      placeOfSupply: r.placeOfSupply == null ? null : str(r.placeOfSupply),
      reverseCharge: r.reverseCharge === true, rate: num(r.rate), taxable: num(r.taxable),
      cgst: num(r.cgst), sgst: num(r.sgst), igst: num(r.igst),
    })),
    b2cl: b2cl.map((r) => ({
      invoiceNumber: str(r.invoiceNumber), invoiceDate: dateIso(r.invoiceDate),
      invoiceValue: num(r.invoiceValue), placeOfSupply: r.placeOfSupply == null ? null : str(r.placeOfSupply),
      rate: num(r.rate), taxable: num(r.taxable), igst: num(r.igst),
    })),
    b2cs: b2cs.map((r) => ({
      placeOfSupply: str(r.placeOfSupply), supplyType: str(r.supplyType), rate: num(r.rate),
      taxable: num(r.taxable), cgst: num(r.cgst), sgst: num(r.sgst), igst: num(r.igst),
    })),
    cdnr: cdnr.map((r) => ({
      noteNumber: str(r.noteNumber), noteDate: dateIso(r.noteDate), gstin: str(r.gstin),
      receiver: r.receiver == null ? "" : str(r.receiver), noteValue: num(r.noteValue),
      placeOfSupply: r.placeOfSupply == null ? null : str(r.placeOfSupply),
      rate: num(r.rate), taxable: num(r.taxable), cgst: num(r.cgst), sgst: num(r.sgst), igst: num(r.igst),
    })),
    cdnur: cdnur.map((r) => ({
      noteNumber: str(r.noteNumber), noteDate: dateIso(r.noteDate), urType: "B2CL",
      receiver: r.receiver == null ? "" : str(r.receiver), noteValue: num(r.noteValue),
      placeOfSupply: r.placeOfSupply == null ? null : str(r.placeOfSupply),
      rate: num(r.rate), taxable: num(r.taxable), cgst: num(r.cgst), sgst: num(r.sgst), igst: num(r.igst),
    })),
    exemp: exemp.map((r) => ({
      regType: str(r.regType), supplyType: str(r.supplyType), exempted: num(r.exempted),
    })),
    hsnB2b: hsnB2b.map((r) => ({
      hsnCode: str(r.hsnCode), uqc: DEFAULT_UQC, rate: num(r.rate), qty: num(r.qty),
      taxable: num(r.taxable), cgst: num(r.cgst), sgst: num(r.sgst), igst: num(r.igst),
    })),
    hsnB2c: hsnB2c.map((r) => ({
      hsnCode: str(r.hsnCode), uqc: DEFAULT_UQC, rate: num(r.rate), qty: num(r.qty),
      taxable: num(r.taxable), cgst: num(r.cgst), sgst: num(r.sgst), igst: num(r.igst),
    })),
    docs: [
      {
        docType: "Invoices for outward supply",
        firstNo: docInv?.firstNo == null ? null : str(docInv.firstNo),
        lastNo: docInv?.lastNo == null ? null : str(docInv.lastNo),
        issued: num(docInv?.issued), cancelled: num(docInv?.cancelled),
      },
      {
        docType: "Credit Note",
        firstNo: num(docCn?.issued) === 0 ? null : docCn?.firstNo == null ? null : str(docCn.firstNo),
        lastNo: num(docCn?.issued) === 0 ? null : docCn?.lastNo == null ? null : str(docCn.lastNo),
        issued: num(docCn?.issued), cancelled: 0,
      },
    ],
    totals: { invoices: num(totals?.invoices), taxable: num(totals?.taxable), tax: num(totals?.tax) },
  };
}

export type Gstr1Dataset = Awaited<ReturnType<typeof getGstr1Dataset>>;
