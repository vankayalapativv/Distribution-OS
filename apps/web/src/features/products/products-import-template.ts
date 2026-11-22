import { downloadSheets } from "@/lib/xlsx-io";
import { PRODUCT_SEGMENTS } from "./chip-toggle";

/** Column headers of the Products template — the parser keys off these exactly. */
export const PRODUCT_COLUMNS = [
  "Product Name", "Brand", "Unit", "Segments", "HSN", "Pack Size (L)",
] as const;

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
