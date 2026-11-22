import { ApiRequestError } from "@/lib/api-client";
import type { ProductPack, ProductUnit } from "./products-api";

/** The fields a validation message can attach to. */
export type ProductField = "name" | "brand" | "hsnCode" | "segments" | "packs";
export type FieldErrors = Partial<Record<ProductField, string>>;

/** Which wizard step owns each field — used to jump to the right step on error. */
export const FIELD_STEP: Record<ProductField, number> = {
  name: 0, brand: 0, hsnCode: 0, segments: 1, packs: 2,
};

export interface ProductFields {
  name: string;
  brand: string;
  hsnCode: string;
  unit: ProductUnit;
  segments: string[];
  packs: ProductPack[];
}

/**
 * Normalize a product name the same way the server does before its uniqueness
 * check (swap non-breaking spaces, collapse whitespace, trim), so the live
 * duplicate warning matches exactly what the server would reject on save.
 */
export function normalizeProductName(name: string): string {
  return name.replaceAll(" ", " ").replaceAll(/\s+/g, " ").trim();
}

/** Per-field validation. `existingNames` holds normalized catalogue names (minus
 *  the product being edited) so a name already in use is flagged before save. */
export function computeFieldErrors(f: ProductFields, existingNames: ReadonlySet<string>): FieldErrors {
  const e: FieldErrors = {};
  const name = normalizeProductName(f.name);
  if (!name) e.name = "Product name is required.";
  else if (existingNames.has(name)) e.name = `“${name}” is already in the catalogue.`;

  if (!f.brand.trim()) e.brand = "Pick a brand, or type a new one.";

  const hsn = f.hsnCode.trim();
  if (!hsn) e.hsnCode = "HSN code is required.";
  else if (!/^\d{8}$/.test(hsn)) e.hsnCode = "HSN code must be exactly 8 digits.";

  if (f.segments.length === 0) e.segments = "Pick at least one segment.";
  // Litres products need pack sizes; quantity products are sold by the piece.
  if (f.unit === "litres" && f.packs.length === 0) e.packs = "Add at least one pack size.";
  return e;
}

/** Back-compat: the first field error as a single message, or null when valid. */
export function validateProductForm(f: ProductFields): string | null {
  const e = computeFieldErrors(f, new Set());
  return e.name ?? e.brand ?? e.hsnCode ?? e.segments ?? e.packs ?? null;
}

/** Map a save failure to the field it belongs to (so we can show + focus it). */
export function fieldForServerError(err: unknown): ProductField | null {
  if (!(err instanceof ApiRequestError)) return null;
  const m = err.message.toLowerCase();
  if (err.status === 409) return "name"; // DUPLICATE — "Product … already exists."
  if (err.status === 422) {
    if (m.includes("segment")) return "segments";
    if (m.includes("hsn")) return "hsnCode";
    if (m.includes("pack")) return "packs";
    if (m.includes("name")) return "name";
  }
  return null;
}
