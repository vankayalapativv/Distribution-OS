import { downloadSheets, type SheetSpec } from "@/lib/xlsx-io";
import { packLabel, type Sku, type StockUnit } from "./stock-api";

export type StockImportMode = "stock_in" | "opening";

/** A parsed, catalogue-resolved stock line ready to drop into the entry grid. */
export interface ImportedStockLine {
  productId: string;
  productName: string;
  packSizeLitres: number;
  brand: string | null;
  unit: StockUnit;
  qty: string;
  rate: string;
  batch: string;
  expiry: string;
  rack: string;
  shelf: string;
  bin: string;
}

export interface StockReviewRow {
  line: ImportedStockLine;
  error: string | null;
}

/** Columns per mode. The last column, "SKU ID", is a hidden technical key
 *  (`productId|packSize`) so a filled row maps back to the exact catalogue SKU. */
const COLS: Record<StockImportMode, string[]> = {
  stock_in: ["Product", "Pack", "Brand", "Qty", "Rate", "Batch", "Expiry (YYYY-MM)", "Rack", "Shelf", "Bin", "SKU ID"],
  opening: ["Product", "Pack", "Brand", "Qty", "Rate", "Batch", "Expiry (YYYY-MM)", "Rack", "Shelf", "Bin", "SKU ID"],
};

const skuKey = (s: { productId: string; packSizeLitres: number }) => `${s.productId}|${s.packSizeLitres}`;

/** Marker for a greyed example row: the parser skips any row whose Product
 *  contains this, so example rows are never imported. */
const EXAMPLE_MARK = "EXAMPLE — delete this row";

/** Illustrative example rows (ignored on upload) showing how to fill a line:
 *  a full fill, a qty-only fill, a piece/"pcs" product, and a minimal one. */
function exampleRows(mode: StockImportMode, brand: string | null): (string | number | null)[][] {
  const b = brand ?? "Fuchs";
  // Rate (col 5) is required on every row; examples show it filled.
  if (mode === "stock_in") {
    return [
      [EXAMPLE_MARK, "5 L", b, 24, 1050, "BATCH-01", "2027-06", "A", "2", "", "EXAMPLE"],
      [EXAMPLE_MARK, "1 L", b, 120, 260, "", "", "", "", "", "EXAMPLE"],
      [EXAMPLE_MARK, "pcs", b, 50, 45, "", "", "", "", "", "EXAMPLE"],
      [EXAMPLE_MARK, "200 L", b, 2, 18000, "", "", "", "", "", "EXAMPLE"],
    ];
  }
  return [
    [EXAMPLE_MARK, "5 L", b, 24, 1050, "BATCH-01", "2027-06", "A", "2", "", "EXAMPLE"],
    [EXAMPLE_MARK, "1 L", b, 120, 260, "", "", "", "", "", "EXAMPLE"],
    [EXAMPLE_MARK, "pcs", b, 50, 45, "", "", "", "", "", "EXAMPLE"],
    [EXAMPLE_MARK, "200 L", b, 2, 18000, "OPEN-02", "", "", "", "", "EXAMPLE"],
  ];
}

/** Build + download the pre-filled template: a few greyed example rows (ignored
 *  on upload), then every catalogue SKU (brand-filtered for stock-in) as a
 *  locked Product/Pack/Brand row with blank fill columns. */
export async function downloadStockTemplate(mode: StockImportMode, skus: Sku[], brand: string | null): Promise<void> {
  const cols = COLS[mode];
  const list = mode === "stock_in" && brand ? skus.filter((s) => s.brand === brand) : skus;
  const sorted = [...list].sort((a, b) => a.productName.localeCompare(b.productName) || a.packSizeLitres - b.packSizeLitres);
  const header = [...cols] as (string | number)[];
  const rows: (string | number | null)[][] = [header, ...exampleRows(mode, brand)];
  for (const s of sorted) {
    const lead = [s.productName, packLabel(s.packSizeLitres, s.unit), s.brand ?? ""];
    const fill = ["", "", "", "", "", "", ""]; // Qty, Rate, Batch, Expiry, Rack, Shelf, Bin
    rows.push([...lead, ...fill, skuKey(s)]);
  }
  const sheet: SheetSpec = {
    name: mode === "stock_in" ? "Stock-in" : "Opening stock",
    rows,
    colWidths: cols.map((c) => (c === "Product" ? 34 : 12)),
    hiddenCols: [cols.length - 1], // hide the technical SKU ID column
  };
  const filename = mode === "stock_in" ? `Stock-in-template${brand ? `-${brand}` : ""}` : "Opening-stock-template";
  await downloadSheets(filename, [sheet]);
}

function toQty(v: string): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Normalise an expiry cell to a full `yyyy-mm-dd` (end of month) — the format
 *  the grid's month picker reads. Accepts `yyyy-mm` or `yyyy-mm-dd`; else "". */
function normExpiry(v: string): string {
  const t = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t; // already a full date
  const m = /^(\d{4})-(\d{1,2})$/.exec(t); // year-month → last day of that month
  if (!m) return "";
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return "";
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

/**
 * Parse the filled template into review rows. Rows with a blank Qty are ignored
 * (the client only fills the SKUs they have). Each filled row is resolved against
 * the catalogue by its hidden SKU ID, so Product/Brand come from the catalogue,
 * not the (possibly edited) text cells.
 */
export function parseStockRows(mode: StockImportMode, rows: Record<string, string>[], skus: Sku[], brand: string | null): StockReviewRow[] {
  const byKey = new Map(skus.map((s) => [skuKey(s), s]));
  const out: StockReviewRow[] = [];
  for (const r of rows) {
    if ((r.Product ?? "").toLowerCase().includes("delete this row")) continue; // greyed example row
    const qtyRaw = (r.Qty ?? "").trim();
    if (!qtyRaw) continue; // not receiving this SKU
    const id = (r["SKU ID"] ?? "").trim();
    const sku = byKey.get(id);
    const rate = (r.Rate ?? "").trim();
    const line: ImportedStockLine = {
      productId: sku?.productId ?? "",
      productName: sku?.productName ?? (r.Product ?? "").trim(),
      packSizeLitres: sku?.packSizeLitres ?? Number(r.Pack ?? 0),
      brand: sku?.brand ?? null,
      unit: sku?.unit ?? "litres",
      qty: qtyRaw,
      rate,
      batch: (r.Batch ?? "").trim(),
      expiry: normExpiry(r["Expiry (YYYY-MM)"] ?? ""),
      rack: (r.Rack ?? "").trim(),
      shelf: (r.Shelf ?? "").trim(),
      bin: (r.Bin ?? "").trim(),
    };
    out.push({ line, error: validate(mode, line, sku, brand, rate) });
  }
  return out;
}

function validate(mode: StockImportMode, line: ImportedStockLine, sku: Sku | undefined, brand: string | null, rate: string): string | null {
  if (!sku) return "Unknown SKU — use a row from the downloaded template.";
  if (mode === "stock_in" && brand && sku.brand !== brand) return `Not a ${brand} product.`;
  if (toQty(line.qty) === null) return "Qty must be a number greater than 0.";
  if (rate === "") return "Rate is required.";
  const n = Number(rate);
  if (!Number.isFinite(n) || n <= 0) return "Rate must be a number greater than 0.";
  return null;
}
