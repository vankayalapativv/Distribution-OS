import type { CellDef, RowInput, Styles, UserOptions } from "jspdf-autotable";
import { companyLetterheadLines, type CompanyProfile } from "./company";

/**
 * One-click PDF generator for the web app's list/statement exports (Customer
 * ledger, Customers list, …). Builds a real PDF with jsPDF + autotable and
 * downloads it directly — no browser print dialog, no extra tab. jsPDF and
 * autotable are loaded on demand so they stay out of every other page's bundle.
 *
 * Note: the jsPDF standard fonts (Helvetica/Courier) predate the ₹ glyph, so
 * currency is written as "Rs." in headings; amounts are plain numbers with
 * Dr/Cr, so no ₹ is needed in the body.
 */

export interface TablePdfOptions {
  /** Downloaded file name, e.g. "Customer List.pdf". */
  fileName: string;
  /** The company letterhead (Settings → Company). Empty fields are omitted; an
   *  all-blank profile prints no letterhead at all. */
  company: CompanyProfile;
  /** Big bold heading under the letterhead, e.g. "Ledger". */
  title: string;
  /** One-line caption under the title (filters / range / generated-on). */
  metaLine: string;
  /** Column header cells. */
  head: RowInput;
  /** Data rows (arrays of strings or autotable CellDef objects). */
  body: RowInput[];
  /** Totals rows rendered once after the body. */
  foot?: RowInput[];
  /** Per-column style overrides (alignment, width, font). */
  columnStyles?: UserOptions["columnStyles"];
  /** Per-cell hook for special row styling (e.g. shaded opening balance). */
  didParseCell?: UserOptions["didParseCell"];
  /** Banded rows for long lists. */
  zebra?: boolean;
}

const RULE: [number, number, number] = [60, 60, 60];
const HAIRLINE: [number, number, number] = [225, 225, 225];

export async function downloadTablePdf(opts: TablePdfOptions): Promise<void> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 32;

  // ── Letterhead + title + meta (page 1 only) ──
  // The company name + address lines come from Settings → Company; empty fields
  // are omitted and an all-blank profile prints no letterhead.
  const companyName = opts.company.legalName.trim();
  const headerLines = companyLetterheadLines(opts.company);
  const hasLetterhead = Boolean(companyName) || headerLines.length > 0;

  let y = 44;
  if (companyName) {
    doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(0);
    doc.text(companyName, pageW / 2, y, { align: "center" });
  }
  if (headerLines.length > 0) {
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(70);
    headerLines.forEach((line, i) => {
      if (companyName || i > 0) y += 11;
      doc.text(line, pageW / 2, y, { align: "center" });
    });
  }
  y += hasLetterhead ? 20 : 0;
  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(0);
  doc.text(opts.title, pageW / 2, y, { align: "center" });
  y += 13;
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(90);
  doc.text(opts.metaLine, pageW / 2, y, { align: "center" });
  doc.setTextColor(0);

  const baseCell: Partial<Styles> = { fontSize: 8, cellPadding: 3, overflow: "linebreak" };

  autoTable(doc, {
    head: [opts.head],
    body: opts.body,
    foot: opts.foot,
    startY: y + 14,
    margin: { top: margin, left: margin, right: margin, bottom: 34 },
    theme: "plain",
    styles: { ...baseCell, textColor: [40, 40, 40] },
    headStyles: {
      fontStyle: "bold",
      textColor: [20, 20, 20],
      fillColor: [255, 255, 255],
      lineColor: RULE,
      lineWidth: { top: 0.75, bottom: 0.75 },
    },
    bodyStyles: { lineColor: HAIRLINE, lineWidth: { bottom: 0.4 } },
    footStyles: {
      fontStyle: "bold",
      textColor: [0, 0, 0],
      fillColor: [255, 255, 255],
      lineColor: RULE,
      lineWidth: { top: 0.75 },
    },
    alternateRowStyles: opts.zebra ? { fillColor: [250, 250, 250] } : {},
    columnStyles: opts.columnStyles,
    didParseCell: opts.didParseCell,
  });

  // ── Footer (company + Page X of Y) on every page ──
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(110);
    doc.setDrawColor(...HAIRLINE).setLineWidth(0.5);
    doc.line(margin, pageH - 24, pageW - margin, pageH - 24);
    if (companyName) doc.text(companyName, margin, pageH - 14);
    doc.text(`Page ${i} of ${total}`, pageW - margin, pageH - 14, { align: "right" });
  }
  doc.setTextColor(0);

  doc.save(opts.fileName);
}

/** Shared helper: a right-aligned totals label spanning the leading columns. */
export function footLabelCell(text: string, colSpan: number): CellDef {
  return { content: text, colSpan, styles: { halign: "right" } };
}
