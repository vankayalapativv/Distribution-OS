/**
 * Per-report downloads — one XLSX sheet or a titled PDF for a SINGLE report's
 * fetched slice. Heavy libs (xlsx / jspdf) are imported at call time so they
 * stay out of the page bundle.
 */
import { reportAoa } from "./reports-aoa";
import type { ReportKey, ReportSlice } from "./reports-types";

/** Range-based file stem, e.g. sri-aparajita-oils-2026-08-28 (single day) or ..._end. */
function fileBase(key: ReportKey, slice: ReportSlice): string {
  const { start, end } = slice.period;
  const stamp = start === end ? start : `${start}_${end}`;
  return `sri-aparajita-${key}-${stamp}`;
}

/** Excel sheet names cap at 31 chars and forbid a few symbols. */
function sheetName(title: string): string {
  return title.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
}

export async function downloadReportXlsx(
  key: ReportKey,
  title: string,
  slice: ReportSlice,
): Promise<void> {
  const aoa = reportAoa(key, slice);
  if (!aoa) return;
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), sheetName(title));
  XLSX.writeFile(wb, `${fileBase(key, slice)}.xlsx`);
}

export async function downloadReportPdf(
  key: ReportKey,
  title: string,
  slice: ReportSlice,
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

  doc.save(`${fileBase(key, slice)}.pdf`);
}
