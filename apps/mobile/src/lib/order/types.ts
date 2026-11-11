/** Domain types + tiny helpers for the (online-only) New Order flow. */

export interface Product {
  id: string;
  productName: string;
  /** Brand (e.g. "Fuchs" / "Savsol"); null if unbranded. Drives the brand switch. */
  brand: string | null;
  /** How it's sold: "litres" (pick a pack size) or "quantity" (pieces, no pack). */
  unit: "litres" | "quantity";
  segments: string[];
  /** Pack sizes (litres) this product is sold in — empty for quantity products. */
  packSizes: number[];
}

export interface CreditStatus {
  creditBlocked: boolean;
  creditOverdueDays: number;
  /** Net balance: positive = owes. */
  totalOutstanding: number;
}

/** One committed line for a product (a product can hold several).
 *  `packSizeLitres` is null for quantity products (sold by the piece). */
export interface OrderLine {
  packSizeLitres: number | null;
  quantityUnits: number;
  segment: string | null;
}

/** Segment chip order (matches the product catalogue segments). */
export const SEGMENT_ORDER = ["Car", "2W", "3W", "Commercial", "Agri", "Gear Oil", "Coolant", "Grease"];

/** Parse a typed quantity: whole number ≥ 1, else null. */
export function parseQty(text: string): number | null {
  const n = Number(text);
  return Number.isInteger(n) && n >= 1 ? n : null;
}
