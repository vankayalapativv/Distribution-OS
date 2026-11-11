import { downloadSheets } from "@/lib/xlsx-io";
import { PRODUCT_SEGMENTS } from "./chip-toggle";

/** Column headers of the Products template — the parser keys off these exactly. */
export const PRODUCT_COLUMNS = [
  "Product Name", "Brand", "Unit", "Segments", "HSN", "Pack Size (L)",
] as const;

export interface BulkPack { packSize: number }
export interface BulkProductInput {
  productName: string;
  brand: string;
  hsnCode: string;
  unit: "litres" | "quantity";
  segments: string[];
  packs: BulkPack[];
}

/** One product in the review table: the parsed input + a client-side error (if any)
 *  and later the server's per-row error after Confirm. */
export interface ProductReviewRow {
  product: BulkProductInput;
  error: string | null;
  serverError?: string | null;
}

/** Mirror the server's product-name normalisation (NBSP → space, collapse, trim). */
function normName(name: string): string {
  return name.replaceAll(" ", " ").replaceAll(/\s+/g, " ").trim();
}

function toNum(v: string): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Build + download the Products template: a `Products` sheet (headers + two
 *  example rows showing a 2-pack product) and a `Reference` sheet listing the
 *  valid brands + segments and the rules. */
export async function downloadProductsTemplate(brands: string[]): Promise<void> {
  const header = [...PRODUCT_COLUMNS] as (string | number)[];
  const ex = "Example Oil 5W-30 (delete this row)";
  const exQ = "Example Microfibre Cloth (delete this row)";
  const rows: (string | number | null)[][] = [
    header,
    // Litres product — one row per pack size (same name + brand = one product).
    [ex, "Fuchs", "litres", "Car, 2W", "27101980", 5],
    [ex, "Fuchs", "litres", "Car, 2W", "27101980", 1],
    // Quantity product — sold by the piece: unit = "quantity", pack blank.
    [exQ, "Kelvinn", "quantity", "Car", "63079090", ""],
  ];
  const ref: (string | number | null)[][] = [
    ["Reference — allowed values (do not upload this sheet's layout; fill the Products sheet)"],
    [],
    ["Valid Segments — comma-separate multiple in the Segments column, e.g. \"Car, 2W\""],
    ...PRODUCT_SEGMENTS.map((s) => [s]),
    [],
    ["Valid Brands — pick one of these or type a new brand"],
    ...brands.map((b) => [b]),
    [],
    ["Unit — 'litres' (needs one row per pack size) or 'quantity' (sold by piece, leave Pack Size blank)"],
    ["HSN — exactly 8 digits."],
    ["One product = all rows sharing the same Product Name + Brand; each row is one pack size."],
    ["Pricing (MRP / MOP / DLP) is NOT set here — it's entered in the Margin simulator."],
  ];
  await downloadSheets("Products-template", [
    { name: "Products", rows, colWidths: [34, 14, 10, 18, 12, 12] },
    { name: "Reference", rows: ref, colWidths: [72] },
  ]);
}

function parseSegments(cell: string): string[] {
  return [...new Set(cell.split(/[,;/|]/).map((s) => s.trim()).filter(Boolean))];
}

function validate(p: BulkProductInput): string | null {
  if (!p.brand) return "Brand is required.";
  if (!/^\d{8}$/.test(p.hsnCode)) return "HSN must be exactly 8 digits.";
  if (p.segments.length === 0) return "Pick at least one segment.";
  const badSeg = p.segments.find((s) => !(PRODUCT_SEGMENTS as readonly string[]).includes(s));
  if (badSeg) return `Invalid segment: ${badSeg}.`;
  if (p.unit === "litres" && p.packs.length === 0) return "Add at least one pack size.";
  return null;
}

/**
 * Group the sheet rows into products (rows sharing Product Name + Brand merge,
 * each contributing one pack) and validate each client-side. Blank-name rows and
 * the greyed example row are ignored.
 */
export function parseProductsRows(rows: Record<string, string>[]): ProductReviewRow[] {
  const order: string[] = [];
  const byKey = new Map<string, BulkProductInput>();
  for (const r of rows) {
    const name = normName(r["Product Name"] ?? "");
    if (!name || name.toLowerCase().includes("delete this row")) continue;
    const brand = (r.Brand ?? "").trim();
    const key = `${name.toLowerCase()}||${brand.toLowerCase()}`;
    let p = byKey.get(key);
    if (!p) {
      p = {
        productName: name,
        brand,
        hsnCode: (r.HSN ?? "").trim(),
        unit: (r.Unit ?? "").trim().toLowerCase() === "quantity" ? "quantity" : "litres",
        segments: parseSegments(r.Segments ?? ""),
        packs: [],
      };
      byKey.set(key, p);
      order.push(key);
    }
    const size = toNum(r["Pack Size (L)"] ?? "");
    if (p.unit === "litres" && size !== null) {
      p.packs.push({ packSize: size });
    }
  }
  return order.map((key) => {
    const product = byKey.get(key)!;
    return { product, error: validate(product) };
  });
}
