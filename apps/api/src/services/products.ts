import { ApiError } from "../lib/errors";
import type { SqlClient } from "../lib/db";
import { buildSearchConds, resolvePage, resolveSort } from "../lib/pagination";
import { ensureBrand } from "./brands";
import { packWriteArrays, parsePacks } from "./product-packs";

interface ProductContext {
  userId: string;
}

type Row = Record<string, unknown>;

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
}

/** Segments a product may belong to — mirrors the web SEGMENT_OPTIONS list.
 *  "Coolant"/"Grease" are product-type segments (like "Gear Oil"), added for
 *  the Savsol catalogue which sells coolant and grease alongside the oils. */
export const ALLOWED_SEGMENTS = [
  "Car",
  "2W",
  "3W",
  "Commercial",
  "Agri",
  "Gear Oil",
  "Coolant",
  "Grease",
] as const;

function strArray(raw: unknown): string[] {
  return Array.isArray(raw)
    ? (raw as unknown[]).filter((s): s is string => typeof s === "string")
    : [];
}

/** Validate + normalise the segment list: at least one, all from the allowed set. */
function validateSegments(raw: unknown): string[] {
  const cleaned = [...new Set(strArray(raw).map((s) => s.trim()).filter(Boolean))];
  if (cleaned.length === 0) {
    throw new ApiError("INVALID_FIELD", "Select at least one segment.", 422);
  }
  const bad = cleaned.filter((s) => !(ALLOWED_SEGMENTS as readonly string[]).includes(s));
  if (bad.length) {
    throw new ApiError("INVALID_FIELD", `Invalid segment: ${bad.join(", ")}.`, 422);
  }
  return cleaned.sort((a, b) => a.localeCompare(b));
}

function mapPacks(raw: unknown) {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((p) => {
    const rec = (p ?? {}) as Record<string, unknown>;
    return {
      packSize: Number(rec.packSize),
      // Inventory (Stock Journal): current balance for this product+pack SKU.
      // null stockItemId ⇒ no stock row yet (never received/counted).
      stockItemId: rec.stockItemId ? str(rec.stockItemId) : null,
      stockQty: rec.stockQty == null ? null : Number(rec.stockQty),
    };
  });
}

/** Unit a product is sold in: litres (with pack sizes) or plain quantity (pieces). */
export type ProductUnit = "litres" | "quantity";

function normaliseUnit(raw: unknown): ProductUnit {
  return raw === "quantity" ? "quantity" : "litres";
}

function mapProductRow(row: Row) {
  return {
    id: str(row.id),
    productName: str(row.productName),
    brand: str(row.brand),
    hsnCode: str(row.hsnCode),
    unit: normaliseUnit(row.unit),
    segments: strArray(row.segments),
    packs: mapPacks(row.packs),
    status: str(row.status),
    createdAt: str(row.createdAt),
  };
}

/** Full product row (id + name + brand + hsn + segments + priced packs) select. */
const PRODUCT_SELECT = `
  p.id,
  p.product_name as "productName",
  p.brand,
  p.hsn_code as "hsnCode",
  p.unit,
  coalesce((
    select array_agg(ps.segment order by ps.segment)
    from product_segments ps where ps.product_id = p.id
  ), '{}') as segments,
  coalesce((
    select json_agg(json_build_object(
                      'packSize', pp.pack_size_litres,
                      'stockItemId', null, 'stockQty', null)
                    order by pp.pack_size_litres)
    from product_packs pp
    where pp.product_id = p.id
  ), '[]') as "packs",
  p.status,
  p.created_at as "createdAt"`;

export async function listManagedProducts(sql: SqlClient, context: ProductContext) {
  const rows = (await sql.query(
    `/* list_managed_products */
     select ${PRODUCT_SELECT}
     from products p
     order by p.product_name
     limit 500`,
    [],
  )) as Row[];
  return rows.map(mapProductRow);
}

export interface PagedProductsParams {
  search?: string | null;
  status?: string | null;
  /** Exact-match brand filter (e.g. "Fuchs" / "Savsol"); blank = all brands. */
  brand?: string | null;
  sort?: string | null;
  dir?: string | null;
  page?: number | null;
  pageSize?: number | null;
}

const PRODUCT_SORTS: Record<string, string> = {
  productName: "p.product_name",
  status: "p.status",
  createdAt: "p.created_at",
};

// Normalized search haystack for an oil: name + brand + HSN + its segments,
// lowercased with non-alphanumerics stripped (mirrors `searchTokens`). Trusted
// SQL — references only fixed columns, no client input.
const OIL_SEARCH_BLOB = `lower(regexp_replace(
  coalesce(p.product_name, '') || ' ' || coalesce(p.brand, '') || ' ' || coalesce(p.hsn_code, '') || ' ' ||
  coalesce((select string_agg(ps.segment, ' ') from product_segments ps where ps.product_id = p.id), ''),
  '[^A-Za-z0-9]', '', 'g'))`;

/** Server-side filtered/sorted/paginated oils for the web table (table standard). */
export async function listManagedProductsPaged(
  sql: SqlClient,
  context: ProductContext,
  opts: PagedProductsParams,
) {
  const conds: string[] = [];
  const params: unknown[] = [];
  // Free-text search matches name + brand + segments + HSN (normalized: spacing /
  // punctuation-insensitive, wildcard-safe, every typed word must appear).
  const { conds: searchConds, params: searchParams } = buildSearchConds(OIL_SEARCH_BLOB, opts.search, params.length);
  conds.push(...searchConds);
  params.push(...searchParams);
  const status = (opts.status ?? "").trim();
  if (status) {
    params.push(status);
    conds.push(`p.status = $${params.length}`);
  }
  const brand = (opts.brand ?? "").trim();
  if (brand) {
    params.push(brand);
    conds.push(`p.brand = $${params.length}`);
  }
  const whereSql = conds.length ? `where ${conds.join(" and ")}` : "";
  const sort = resolveSort(opts.sort, opts.dir, PRODUCT_SORTS, "productName");
  const { limit, offset, page, pageSize } = resolvePage(opts.page, opts.pageSize);

  // Count and page are independent — one parallel batch, not two sequential
  // ~50ms round-trips.
  const [countResult, rowsResult] = await Promise.all([
    sql.query(
      `/* list_managed_products_paged_count */ select count(*)::int as total from products p ${whereSql}`,
      params,
    ),
    sql.query(
      `/* list_managed_products_paged */
     select ${PRODUCT_SELECT}
     from products p
     ${whereSql}
     order by ${sort.expr} ${sort.dir} nulls last, p.product_name asc
     limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, limit, offset],
    ),
  ]);
  const [countRow] = countResult as Row[];
  const rows = rowsResult as Row[];

  return { rows: rows.map(mapProductRow), total: Number(countRow?.total ?? 0), page, pageSize };
}

export interface ProductInput {
  productName: string;
  brand: unknown;
  segments: unknown;
  /** Pack rows `[{ packSize }]` — size only (pricing lives in the Margin simulator).
   *  Ignored for quantity-unit products (they have no pack sizes). */
  packs: unknown;
  /** HSN code — required; drives invoice-line → SKU matching (2710 oil, 3820 coolant, …). */
  hsnCode: string;
  /** How the product is sold: 'litres' (with pack sizes) or 'quantity' (pieces). */
  unit?: unknown;
}

/**
 * Resolve the pack-write arrays for a product, honouring its unit:
 *  - litres  → at least one pack size required (existing rules apply)
 *  - quantity → no packs at all (any submitted packs are ignored)
 */
function resolvePackArrays(unit: ProductUnit, rawPacks: unknown) {
  if (unit === "quantity") {
    return { sizes: [] } as ReturnType<typeof packWriteArrays>;
  }
  return packWriteArrays(parsePacks(rawPacks));
}

/** HSN must be an exactly-8-digit code. */
export function validateHsn(raw: string): string {
  const hsn = (raw ?? "").trim();
  if (!/^\d{8}$/.test(hsn)) {
    throw new ApiError("INVALID_FIELD", "HSN code must be exactly 8 digits.", 422);
  }
  return hsn;
}

/** Re-read a full product (name + segments + packs) by id. */
async function selectProductById(sql: SqlClient, id: string) {
  const rows = (await sql.query(
    `/* select_product_by_id */
     select ${PRODUCT_SELECT} from products p where p.id = $1::uuid`,
    [id],
  )) as Row[];
  return rows[0] ? mapProductRow(rows[0]) : null;
}

/** Normalize a product name on the way in: swap non-breaking spaces for regular
 *  ones, collapse any run of whitespace to a single space, and trim. Names pasted
 *  from Excel/PDF otherwise carry invisible characters (U+00A0, double spaces)
 *  that break search, sorting and the uniqueness check. */
export function normalizeProductName(name: string): string {
  return name.replaceAll("\u00A0", " ").replaceAll(/\s+/g, " ").trim();
}

export async function createProduct(
  sql: SqlClient,
  context: ProductContext,
  input: ProductInput,
) {
  const productName = normalizeProductName(input.productName);
  if (!productName) {
    throw new ApiError("INVALID_FIELD", "Product name is required.", 422);
  }
  const brand = await ensureBrand(sql, "oils", input.brand);
  const segments = validateSegments(input.segments);
  const unit = normaliseUnit(input.unit);
  const { sizes } = resolvePackArrays(unit, input.packs);
  const hsnCode = validateHsn(input.hsnCode);

  const [existing] = await sql`
    select id from products
    where product_name = ${productName}
    limit 1
  `;
  if (existing) {
    throw new ApiError("DUPLICATE", `Product "${productName}" already exists.`, 409);
  }

  // Insert product + segments + pack sizes atomically.
  const [product] = await sql`
    /* create_product */
    with new_product as (
      insert into products (product_name, brand, hsn_code, unit, status)
      values (${productName}, ${brand}, ${hsnCode}, ${unit}, 'active')
      returning id
    ),
    ins_seg as (
      insert into product_segments (product_id, segment)
      select np.id, s from new_product np, unnest(${segments}::text[]) as s
    ),
    ins_pack as (
      insert into product_packs (product_id, pack_size_litres)
      select np.id, s from new_product np, unnest(${sizes}::numeric[]) as s
    )
    select id from new_product
  `;

  const created = await selectProductById(sql, str(product.id));
  return created ?? mapProductRow({ ...product, productName, segments, status: "active" });
}

export interface BulkProductError {
  row: number;
  message: string;
}

export interface BulkProductResult {
  created: number;
  errors: BulkProductError[];
}

interface ValidBulkItem {
  row: number;
  id: string;
  name: string;
  brand: string;
  hsn: string;
  unit: ProductUnit;
  segments: string[];
  sizes: number[];
}

/**
 * Bulk-create products from an array of product inputs (the Products Excel
 * upload). Each row is validated independently; a row that fails validation, is
 * repeated within the file, or whose name already exists in the catalogue is
 * reported in `errors` (1-based `row`) and skipped, while the remaining valid
 * rows insert together in ONE atomic batch (set-based — no round-trip per row).
 */
export async function bulkCreateProducts(
  sql: SqlClient,
  _context: ProductContext,
  items: unknown,
): Promise<BulkProductResult> {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) {
    throw new ApiError("INVALID_FIELD", "Add at least one product row.", 422);
  }

  const errors: BulkProductError[] = [];
  const valids: ValidBulkItem[] = [];
  const seen = new Set<string>();
  list.forEach((raw, idx) => {
    const row = idx + 1;
    const rec = (raw ?? {}) as Record<string, unknown>;
    try {
      const name = normalizeProductName(typeof rec.productName === "string" ? rec.productName : "");
      if (!name) throw new ApiError("INVALID_FIELD", "Product name is required.", 422);
      if (seen.has(name)) throw new ApiError("DUPLICATE", `"${name}" is repeated in the file.`, 409);
      const brand = typeof rec.brand === "string" ? rec.brand.trim() : "";
      if (!brand) throw new ApiError("INVALID_FIELD", "Brand is required.", 422);
      const segments = validateSegments(rec.segments);
      const unit = normaliseUnit(rec.unit);
      const { sizes } = resolvePackArrays(unit, rec.packs);
      const hsn = validateHsn(typeof rec.hsnCode === "string" ? rec.hsnCode : "");
      seen.add(name);
      valids.push({ row, id: crypto.randomUUID(), name, brand, hsn, unit, segments, sizes });
    } catch (err) {
      errors.push({ row, message: err instanceof ApiError ? err.message : "Invalid row." });
    }
  });

  // Names already in the catalogue become errors; the other valid rows still insert.
  if (valids.length > 0) {
    const names = valids.map((v) => v.name);
    const existingRows = await sql`
      /* bulk_products_existing_names */
      select product_name from products where product_name = any(${names}::text[])
    `;
    const taken = new Set(existingRows.map((r) => str(r.product_name)));
    for (let i = valids.length - 1; i >= 0; i--) {
      if (taken.has(valids[i].name)) {
        errors.push({ row: valids[i].row, message: `"${valids[i].name}" already exists in the catalogue.` });
        valids.splice(i, 1);
      }
    }
  }

  errors.sort((a, b) => a.row - b.row);
  if (valids.length === 0) {
    return { created: 0, errors };
  }

  // Build the aligned column arrays for the set-based inserts.
  const ids = valids.map((v) => v.id);
  const distinctBrands = [...new Set(valids.map((v) => v.brand))];
  const segPid: string[] = [];
  const segVal: string[] = [];
  const packPid: string[] = [];
  const packSize: number[] = [];
  for (const v of valids) {
    for (const s of v.segments) {
      segPid.push(v.id);
      segVal.push(s);
    }
    for (const s of v.sizes) {
      packPid.push(v.id);
      packSize.push(s);
    }
  }

  await sql.transaction([
    sql`/* bulk_upsert_brands */
      insert into brands (category, name)
      select 'oils', b from unnest(${distinctBrands}::text[]) as b
      on conflict (enterprise_id, category, name) do nothing`,
    sql`/* bulk_insert_products */
      insert into products (id, product_name, brand, hsn_code, unit, status)
      select id, nm, br, hs, un, 'active'
      from unnest(${ids}::uuid[], ${valids.map((v) => v.name)}::text[], ${valids.map((v) => v.brand)}::text[],
                  ${valids.map((v) => v.hsn)}::text[], ${valids.map((v) => v.unit)}::text[]) as t(id, nm, br, hs, un)`,
    sql`/* bulk_insert_segments */
      insert into product_segments (product_id, segment)
      select pid, seg from unnest(${segPid}::uuid[], ${segVal}::text[]) as t(pid, seg)`,
    sql`/* bulk_insert_packs */
      insert into product_packs (product_id, pack_size_litres)
      select pid, s
      from unnest(${packPid}::uuid[], ${packSize}::numeric[]) as t(pid, s)`,
  ]);

  return { created: valids.length, errors };
}

export async function updateProduct(
  sql: SqlClient,
  context: ProductContext,
  id: string,
  input: ProductInput,
) {
  const productName = normalizeProductName(input.productName);
  if (!productName) {
    throw new ApiError("INVALID_FIELD", "Product name is required.", 422);
  }
  const brand = await ensureBrand(sql, "oils", input.brand);
  const segments = validateSegments(input.segments);
  const unit = normaliseUnit(input.unit);
  const { sizes } = resolvePackArrays(unit, input.packs);
  const hsnCode = validateHsn(input.hsnCode);

  const [existing] = await sql`select id from products where id = ${id}::uuid limit 1`;
  if (!existing) {
    throw new ApiError("NOT_FOUND", "Product not found.", 404);
  }
  const [dup] = await sql`
    select id from products
    where product_name = ${productName} and id <> ${id}::uuid
    limit 1
  `;
  if (dup) {
    throw new ApiError("DUPLICATE", `Product "${productName}" already exists.`, 409);
  }

  // One transaction: a mid-sequence failure must not leave the product with its
  // segments/packs deleted but not re-inserted (createProduct uses a single CTE).
  await sql.transaction([
    sql`update products set product_name = ${productName}, brand = ${brand}, hsn_code = ${hsnCode}, unit = ${unit} where id = ${id}::uuid`,
    sql`delete from product_segments where product_id = ${id}::uuid`,
    sql`
      insert into product_segments (product_id, segment)
      select ${id}::uuid, s from unnest(${segments}::text[]) as s
    `,
    sql`delete from product_packs where product_id = ${id}::uuid`,
    sql`
      insert into product_packs (product_id, pack_size_litres)
      select ${id}::uuid, s
      from unnest(${sizes}::numeric[]) as t(s)
    `,
  ]);

  const updated = await selectProductById(sql, id);
  if (!updated) throw new ApiError("NOT_FOUND", "Product not found.", 404);
  return updated;
}


export async function deleteProduct(
  sql: SqlClient,
  context: ProductContext,
  id: string,
) {
  const [product] = await sql`
    select id, product_name as "productName" from products
    where id = ${id}::uuid
    limit 1
  `;
  if (!product) {
    throw new ApiError("NOT_FOUND", "Product not found.", 404);
  }

  try {
    await sql`
      delete from products
      where id = ${id}::uuid
    `;
  } catch {
    throw new ApiError(
      "CONFLICT",
      "This product is used in existing orders and cannot be deleted.",
      409,
    );
  }
  return { id, productName: str(product.productName) };
}
