/**
 * Builds the official GSTN GSTR-1 Excel workbook from a getGstr1Dataset() result.
 *
 * The GSTN "GSTR-1 Excel Workbook Template" is a fixed layout the GST Offline
 * Tool imports: each section is its own sheet with an exact name, three summary
 * rows (title / labels / computed values) in rows 1-3, the column header row at
 * row 4, and data from row 5. The tool recomputes the summary band on import, so
 * only the sheet names, the header row text, and the per-row data/format must be
 * exact. Layout verified cell-for-cell against a real filed return
 * (VKR SALES OCT 2026.xls). Pure SheetJS → runs on Cloudflare Workers.
 *
 * The workbook ships the COMPLETE template: all 32 sheets in the template's own
 * order (the nine data sheets we populate, plus every amendment / export /
 * advance / e-commerce sheet, the `master` reference sheet and `Help Instruction`
 * reproduced verbatim from the template skeleton) — the GST Offline Tool expects
 * the whole workbook, not only the sheets that carry data.
 */
import * as XLSX from "xlsx";
import type { Gstr1Dataset } from "./invoice-gst-export";
import templateSkeleton from "./gstr1-template-skeleton.json";

type Cell = string | number;
type Aoa = Cell[][];

/** The template's full sheet order + the verbatim contents of every non-data
 *  sheet (amendments, exports, advances, e-commerce, master, Help), extracted
 *  from the official template. */
const TEMPLATE = templateSkeleton as { order: string[]; skeleton: Record<string, Aoa> };

/** GST state/UT codes → names, per the template's `master` sheet (canonical
 *  spellings, e.g. 36 = Telangana). Used to render "NN-Name" places of supply. */
const POS_NAMES: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
  "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
  "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "25": "Daman & Diu", "26": "Dadra & Nagar Haveli & Daman & Diu", "27": "Maharashtra",
  "29": "Karnataka", "30": "Goa", "31": "Lakshdweep", "32": "Kerala", "33": "Tamil Nadu",
  "34": "Puducherry", "35": "Andaman & Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh",
  "38": "Ladakh", "96": "Foreign Country", "97": "Other Territory",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** yyyy-mm-dd → dd-Mon-yyyy (the template's date text, e.g. 01-Oct-2026). */
function fmtDate(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  return `${m[3]}-${MONTHS[Number(m[2]) - 1]}-${m[1]}`;
}

/** "36" or "36-Telengana" → "36-Telangana" (canonical). Falls back to the input. */
function posLabel(v: string | null): string {
  if (!v) return "";
  const code = v.slice(0, 2);
  const name = POS_NAMES[code];
  return name ? `${code}-${name}` : v;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const sum = <T>(rows: T[], f: (r: T) => number) => round2(rows.reduce((s, r) => s + f(r), 0));
const distinct = <T>(rows: T[], f: (r: T) => string) => new Set(rows.map(f)).size;

/** Per-column widths: each column is sized to its widest cell (in characters)
 *  so the whole workbook opens with every value visible. No cap — Excel itself
 *  limits a column to 255 chars, which bounds the very long Help paragraphs. */
export function autoColumnWidths(aoa: Aoa): { wch: number }[] {
  const ncols = aoa.reduce((m, row) => Math.max(m, row.length), 0);
  const cols: { wch: number }[] = [];
  for (let c = 0; c < ncols; c++) {
    let max = 0;
    for (const row of aoa) {
      const v = row[c];
      if (v === undefined || v === null || v === "") continue;
      const len = String(v).length;
      if (len > max) max = len;
    }
    cols.push({ wch: max + 1 }); // +1 so text isn't flush against the edge
  }
  return cols;
}

/** Append an AOA as a sheet under an exact GSTN sheet name, sized to its data. */
function appendSheet(wb: XLSX.WorkBook, name: string, aoa: Aoa): void {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = autoColumnWidths(aoa);
  XLSX.utils.book_append_sheet(wb, ws, name);
}

export function buildGstr1Workbook(data: Gstr1Dataset): ArrayBuffer {
  // Build the nine data sheets, keyed by their exact template name.
  const built: Record<string, Aoa> = {
    "b2b,sez,de": buildB2b(data),
    b2cl: buildB2cl(data),
    b2cs: buildB2cs(data),
    cdnr: buildCdnr(data),
    cdnur: buildCdnur(data),
    exemp: buildExemp(data),
    "hsn(b2b)": buildHsn(data.hsnB2b),
    "hsn(b2c)": buildHsn(data.hsnB2c),
    docs: buildDocs(data),
  };

  // Emit every template sheet in its own order: a data sheet from `built`,
  // otherwise the verbatim skeleton (empty section, master, Help, …).
  const wb = XLSX.utils.book_new();
  for (const name of TEMPLATE.order) {
    const aoa = built[name] ?? TEMPLATE.skeleton[name];
    if (aoa) appendSheet(wb, name, aoa);
  }

  // SheetJS `type: "array"` returns an ArrayBuffer — a clean BodyInit for the
  // Response, matching the invoice-PDF route's shape.
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

function buildB2b(data: Gstr1Dataset): Aoa {
  return [
    ["Summary For B2B, SEZ, DE (4A, 4B, 6B, 6C)", "", "", "", "", "", "", "", "", "", "", "", "HELP"],
    ["No. of Recipients", "", "No. of Invoices", "", "Total Invoice Value", "", "", "", "", "", "", "Total Taxable Value", "Total Cess"],
    [
      distinct(data.b2b, (r) => r.gstin), "", distinct(data.b2b, (r) => r.invoiceNumber), "",
      sum(dedupeInvoices(data.b2b), (r) => r.invoiceValue), "", "", "", "", "", "",
      sum(data.b2b, (r) => r.taxable), 0,
    ],
    ["GSTIN/UIN of Recipient", "Receiver Name", "Invoice Number", "Invoice date", "Invoice Value", "Place Of Supply", "Reverse Charge", "Applicable % of Tax Rate", "Invoice Type", "E-Commerce GSTIN", "Rate", "Taxable Value", "Cess Amount"],
    ...data.b2b.map((r): Cell[] => [
      r.gstin, r.receiver, r.invoiceNumber, fmtDate(r.invoiceDate), r.invoiceValue,
      posLabel(r.placeOfSupply), r.reverseCharge ? "Y" : "N", "", "Regular B2B", "", r.rate, r.taxable, 0,
    ]),
  ];
}

function buildB2cl(data: Gstr1Dataset): Aoa {
  return [
    ["Summary For B2CL(5)", "", "", "", "", "", "", "", "HELP"],
    ["No. of Invoices", "", "", "", "", "", "", "", ""],
    [distinct(data.b2cl, (r) => r.invoiceNumber), "", "", "", "", "", sum(data.b2cl, (r) => r.taxable), 0, ""],
    ["Invoice Number", "Invoice date", "Invoice Value", "Place Of Supply", "Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount", "E-Commerce GSTIN"],
    ...data.b2cl.map((r): Cell[] => [
      r.invoiceNumber, fmtDate(r.invoiceDate), r.invoiceValue, posLabel(r.placeOfSupply), "", r.rate, r.taxable, 0, "",
    ]),
  ];
}

function buildB2cs(data: Gstr1Dataset): Aoa {
  return [
    ["Summary For B2CS(7)", "", "", "", "", "", "HELP"],
    ["", "", "", "", "Total Taxable  Value", "Total Cess", ""],
    ["", "", "", "", sum(data.b2cs, (r) => r.taxable), 0, ""],
    ["Type", "Place Of Supply", "Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount", "E-Commerce GSTIN"],
    ...data.b2cs.map((r): Cell[] => ["OE", posLabel(r.placeOfSupply), "", r.rate, r.taxable, 0, ""]),
  ];
}

function buildCdnr(data: Gstr1Dataset): Aoa {
  return [
    ["Summary For CDNR(9B)", "", "", "", "", "", "", "", "", "", "", "", "HELP"],
    ["No. of Recipients", "", "No. of Notes", "", "", "", "", "", "Total Note Value", "", "", "Total Taxable Value", "Total Cess"],
    [
      distinct(data.cdnr, (r) => r.gstin), "", distinct(data.cdnr, (r) => r.noteNumber), "", "", "", "", "",
      sum(dedupeNotes(data.cdnr), (r) => r.noteValue), "", "", sum(data.cdnr, (r) => r.taxable), 0,
    ],
    ["GSTIN/UIN of Recipient", "Receiver Name", "Note Number", "Note Date", "Note Type", "Place Of Supply", "Reverse Charge", "Note Supply Type", "Note Value", "Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount"],
    ...data.cdnr.map((r): Cell[] => [
      r.gstin, r.receiver, r.noteNumber, fmtDate(r.noteDate), "C", posLabel(r.placeOfSupply), "N", "Regular B2B", r.noteValue, "", r.rate, r.taxable, 0,
    ]),
  ];
}

function buildCdnur(data: Gstr1Dataset): Aoa {
  return [
    ["Summary For CDNUR(9B)", "", "", "", "", "", "", "", "", "HELP"],
    ["", "No. of Notes/Vouchers", "", "", "", "Total Note Value", "", "", "Total Taxable Value", "Total Cess"],
    [
      "", distinct(data.cdnur, (r) => r.noteNumber), "", "", "", sum(dedupeNotes(data.cdnur), (r) => r.noteValue), "", "",
      sum(data.cdnur, (r) => r.taxable), 0,
    ],
    ["UR Type", "Note Number", "Note Date", "Note Type", "Place Of Supply", "Note Value", "Applicable % of Tax Rate", "Rate", "Taxable Value", "Cess Amount"],
    ...data.cdnur.map((r): Cell[] => [
      r.urType, r.noteNumber, fmtDate(r.noteDate), "C", posLabel(r.placeOfSupply), r.noteValue, "", r.rate, r.taxable, 0,
    ]),
  ];
}

function buildDocs(data: Gstr1Dataset): Aoa {
  const docRows = data.docs.filter((d) => d.issued > 0);
  return [
    ["Summary of documents issued during the tax period (13)", "", "", "", "HELP"],
    ["", "", "", "Total Number", "Total Cancelled"],
    ["", "", "", sum(docRows, (d) => d.issued), sum(docRows, (d) => d.cancelled)],
    ["Nature of Document", "Sr. No. From", "Sr. No. To", "Total Number", "Cancelled"],
    ...docRows.map((d): Cell[] => [d.docType, d.firstNo ?? "", d.lastNo ?? "", d.issued, d.cancelled]),
  ];
}

function dedupeInvoices(rows: Gstr1Dataset["b2b"]): Gstr1Dataset["b2b"] {
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.invoiceNumber) ? false : (seen.add(r.invoiceNumber), true)));
}
function dedupeNotes<T extends { noteNumber: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.noteNumber) ? false : (seen.add(r.noteNumber), true)));
}

function buildExemp(data: Gstr1Dataset): Aoa {
  const val = (reg: string, supply: string) =>
    round2(data.exemp.filter((r) => r.regType === reg && r.supplyType === supply).reduce((s, r) => s + r.exempted, 0));
  const rows: Array<[string, number]> = [
    ["Inter-State supplies to registered persons", val("reg", "inter")],
    ["Intra-State supplies to registered persons", val("reg", "intra")],
    ["Inter-State supplies to unregistered persons", val("unreg", "inter")],
    ["Intra-State supplies to unregistered persons", val("unreg", "intra")],
  ];
  const totalExempt = round2(rows.reduce((s, r) => s + r[1], 0));
  return [
    ["Summary For Nil rated, exempted and non GST outward supplies (8)", "", "", "HELP"],
    ["", "Total Nil Rated Supplies", "Total Exempted Supplies", "Total Non-GST Supplies"],
    ["", 0, totalExempt, 0],
    ["Description", "Nil Rated Supplies", "Exempted(other than nil rated/non GST supply)", "Non-GST Supplies"],
    ...rows.map(([desc, v]): Cell[] => [desc, 0, v, 0]),
  ];
}

function buildHsn(rows: Gstr1Dataset["hsnB2b"]): Aoa {
  const totalValue = (r: Gstr1Dataset["hsnB2b"][number]) => round2(r.taxable + r.cgst + r.sgst + r.igst);
  return [
    ["Summary For HSN(12)", "", "", "", "", "", "", "", "", "", "HELP"],
    ["No. of HSN", "", "", "", "Total Value", "", "Total Taxable Value", "Total Integrated Tax", "Total Central Tax", "Total State/UT Tax", "Total Cess"],
    [
      distinct(rows, (r) => `${r.hsnCode}|${r.rate}`), "", "", "", sum(rows, totalValue), "",
      sum(rows, (r) => r.taxable), sum(rows, (r) => r.igst), sum(rows, (r) => r.cgst), sum(rows, (r) => r.sgst), 0,
    ],
    ["HSN", "Description", "UQC", "Total Quantity", "Total Value", "Rate", "Taxable Value", "Integrated Tax Amount", "Central Tax Amount", "State/UT Tax Amount", "Cess Amount"],
    ...rows.map((r): Cell[] => [r.hsnCode, "", r.uqc, r.qty, totalValue(r), r.rate, r.taxable, r.igst, r.cgst, r.sgst, 0]),
  ];
}
