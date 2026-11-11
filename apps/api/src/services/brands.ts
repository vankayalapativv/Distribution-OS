import { ApiError } from "../lib/errors";
import type { SqlClient } from "../lib/db";

/** Brands are kept in separate lists per catalogue category. */
export const BRAND_CATEGORIES = ["oils"] as const;
export type BrandCategory = (typeof BRAND_CATEGORIES)[number];

export function assertBrandCategory(v: unknown): BrandCategory {
  if (typeof v === "string" && (BRAND_CATEGORIES as readonly string[]).includes(v)) {
    return v as BrandCategory;
  }
  throw new ApiError("INVALID_FIELD", "category must be oils.", 422);
}

/**
 * Brand names for a category that actually have at least one SKU, for the
 * pick-or-type dropdown / brand tabs. Derived LIVE from the catalogue — a brand
 * with no products is never listed, and reappears the moment a SKU uses it
 * (this is what "we don't need the brand if it has no SKU" means). Oils live in
 * `products`; the master `brands` table is still written on create
 * (mandatory-brand validation) but no longer drives this list, so orphaned or
 * bulk-imported brands behave correctly.
 */
export async function listBrands(sql: SqlClient, _category: BrandCategory): Promise<string[]> {
  const rows = await sql`/* list_brands_oils */ select distinct btrim(brand) as name from products where brand is not null and btrim(brand) <> '' order by name`;
  return rows.map((r) => String(r.name));
}

/**
 * Validate a mandatory brand and upsert it into the category's list (so typing a
 * new brand while adding a product auto-adds it). Returns the trimmed name.
 */
export async function ensureBrand(
  sql: SqlClient,
  category: BrandCategory,
  raw: unknown,
): Promise<string> {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name) {
    throw new ApiError("INVALID_FIELD", "Brand is required.", 422);
  }
  await sql`
    /* upsert_brand */
    insert into brands (category, name)
    values (${category}, ${name})
    on conflict (category, name) do nothing
  `;
  return name;
}
