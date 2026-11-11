import type { MarginSim } from "./margin-api";

/**
 * Download the margin simulations as an .xlsx workbook — one row per simulation,
 * all value columns (no Actions), plain numeric values. The heavy `xlsx` lib is
 * imported at call time so it stays out of the page bundle. The caller passes the
 * rows to export (the search-filtered set), so the file matches what's on screen.
 */

const HEADER = [
  "Product",
  "Pack (L)",
  "MRP",
  "DLP",
  "Exp / L",
  "Scheme / L",
  "Coupon",
  "MOP",
  "Margin / Pack",
  "Margin / Liter",
] as const;

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function downloadMarginXlsx(sims: MarginSim[]): Promise<void> {
  const XLSX = await import("xlsx");

  const rows = sims.map((s) => [
    s.productName,
    s.packSize,
    s.mrp ?? "",
    s.dlp,
    s.expensePerLiter,
    s.schemePerLiter,
    s.coupon ?? "",
    s.mop,
    s.marginPerPack,
    s.marginPerLiter,
  ]);

  const sheet = XLSX.utils.aoa_to_sheet([[...HEADER], ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Margin Simulator");
  XLSX.writeFile(wb, `Margin Simulator - ${todayStamp()}.xlsx`);
}
