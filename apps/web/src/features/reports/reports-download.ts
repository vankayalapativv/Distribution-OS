/**
 * Per-report downloads — one XLSX sheet or a titled PDF for a SINGLE report's
 * fetched slice, with auto-fit columns (fixes the truncated headers/names). Heavy
 * libs (xlsx / jspdf) are imported at call time so they stay out of the page
 * bundle. Filename: `{LegalName}_({Report})_({Period})` (2026-11-26).
 */
import { format, parseISO } from "date-fns";
import { reportAoa } from "./reports-aoa";
import { ALL_TIME_KEYS, REPORT_SHORT, SNAPSHOT_KEYS } from "./reports-catalog";
import type { Aoa } from "./reports-aoa-flat";
import type { ReportKey, ReportSlice } from "./reports-types";

/** Filename-safe: drop reserved + paren chars (the parens are structural in the
 *  name), collapse whitespace to underscores. */
function slug(s: string): string {
  return s.replace(/[\\/:*?"<>|()]+/g, "").trim().replace(/\s+/g, "_");
}

/** The time-period part of the filename (human dates, underscores). All-time and
 *  snapshot reports ignore the range, so they read "All-time" / "As_of_<date>". */
function periodPart(key: ReportKey, slice: ReportSlice): string {
  if (ALL_TIME_KEYS.has(key)) return "All-time";
  const d = (iso: string) => slug(format(parseISO(iso), "dd MMM yyyy"));
  const { start, end } = slice.period;
  if (SNAPSHOT_KEYS.has(key)) return `As_of_${d(end)}`;
  return start === end ? d(start) : `${d(start)}-${d(end)}`;
}

/** `{LegalName}_({Report})_({Period})`, e.g.
 *  Vardhan_Systems_(Sales_by_segment)_(01_Nov_2026-26_Nov_2026). */
function fileBase(key: ReportKey, slice: ReportSlice, legalName: string | null | undefined): string {
  const company = (legalName && slug(legalName)) || "Report";
  return `${company}_(${slug(REPORT_SHORT[key])})_(${periodPart(key, slice)})`;
}

/** Excel sheet names cap at 31 chars and forbid a few symbols. */
function sheetName(title: string): string {
  return title.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
}

/** Auto-fit column widths (SheetJS `!cols`, in characters) — widest cell per
 *  column, floored so headers breathe and capped so one long value can't blow up
 *  a column. Fixes the truncation ("Sales exe", "Priya Fiel", "Commerc"). */
function colWidths(aoa: Aoa): { wch: number }[] {
  const cols = aoa.reduce((m, r) => Math.max(m, r.length), 0);
  const widths: { wch: number }[] = [];
  for (let c = 0; c < cols; c++) {
    let max = 8;
    for (const row of aoa) {
      const v = row[c];
      const len = v === null || v === undefined ? 0 : String(v).length;
      if (len > max) max = len;
    }
    widths.push({ wch: Math.min(45, max + 2) });
  }
  return widths;
}

export async function downloadReportXlsx(
  key: ReportKey,
  title: string,
  slice: ReportSlice,
  legalName?: string | null,
): Promise<void> {
  const aoa = reportAoa(key, slice);
  if (!aoa) return;
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = colWidths(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName(title));
  XLSX.writeFile(wb, `${fileBase(key, slice, legalName)}.xlsx`);
}

export async function downloadReportPdf(
  key: ReportKey,
  title: string,
  slice: ReportSlice,
  legalName?: string | null,
): Promise<void> {
  const aoa = reportAoa(key, slice);
  if (!aoa) return;
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold").setFontSize(15).text(title, pageW / 2, 40, { align: "center" });
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(90);
  doc.text(`${slice.period.label} · generated ${slice.generatedAt}`, pageW / 2, 54, { align: "center" });
  doc.setTextColor(0);

  autoTable(doc, {
    head: [aoa[0].map(String)],
    body: aoa.slice(1),
    startY: 72,
    margin: { left: 32, right: 32 },
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
  });

  doc.save(`${fileBase(key, slice, legalName)}.pdf`);
}
