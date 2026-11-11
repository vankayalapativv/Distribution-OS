/** Stock locations (godowns) — all under the single company GSTIN. */
import type { SqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";
import { num, str } from "./orders-shared";

function mapLocation(r: Record<string, unknown>) {
  return {
    id: str(r.id),
    name: str(r.name),
    code: r.code == null ? null : str(r.code),
    city: r.city == null ? null : str(r.city),
    state: str(r.state),
    stateCode: str(r.stateCode),
    pincode: r.pincode == null ? null : str(r.pincode),
    isDefault: r.isDefault === true,
    status: str(r.status),
    skuCount: num(r.skuCount),
    totalLitres: num(r.totalLitres),
  };
}

export async function listLocations(sql: SqlClient, opts: { activeOnly?: boolean } = {}) {
  const rows = await sql`
    /* list_stock_locations */
    select l.id, l.name, l.code, l.city, l.state, l.state_code as "stateCode",
           l.pincode, l.is_default as "isDefault", l.status,
           count(distinct (b.product_id, b.pack_size_litres)) filter (where b.qty_units > 0) as "skuCount",
           coalesce(sum(b.qty_units * b.pack_size_litres) filter (where b.qty_units > 0), 0) as "totalLitres"
    from stock_locations l
    left join stock_balances b on b.location_id = l.id
    where (${opts.activeOnly ?? false} = false or l.status = 'active')
    group by l.id
    order by l.is_default desc, l.name
  `;
  return rows.map(mapLocation);
}

export interface LocationInput {
  name: string;
  code: string | null;
  city: string | null;
  state: string | null;
  stateCode: string | null;
  pincode: string | null;
  isDefault: boolean;
}

export async function createLocation(sql: SqlClient, userId: string, input: LocationInput) {
  if (!input.name.trim()) throw new ApiError("INVALID_FIELD", "Godown name is required.", 422);
  const id = crypto.randomUUID();
  try {
    // One transaction: clearing the old default + inserting this one must not
    // leave a window (or a failure) with no default godown.
    const stmts = [];
    if (input.isDefault) stmts.push(sql`update stock_locations set is_default = false where is_default`);
    stmts.push(sql`
      /* create_stock_location */
      insert into stock_locations (id, name, code, city, state, state_code, pincode, is_default, created_by)
      values (${id}::uuid, ${input.name.trim()}, ${input.code}, ${input.city},
              coalesce(${input.state}, 'Telangana'), coalesce(${input.stateCode}, '36'),
              ${input.pincode}, ${input.isDefault}, ${userId}::uuid)
    `);
    await sql.transaction(stmts);
  } catch (err) {
    if (/stock_locations_code_key/.test(String((err as { message?: string }).message))) {
      throw new ApiError("CONFLICT", "That godown code is already used.", 409);
    }
    throw err;
  }
  const rows = await sql`
    select l.id, l.name, l.code, l.city, l.state, l.state_code as "stateCode",
           l.pincode, l.is_default as "isDefault", l.status, 0 as "skuCount", 0 as "totalLitres"
    from stock_locations l where l.id = ${id}::uuid
  `;
  return mapLocation(rows[0]);
}

/** Rename a godown — touches ONLY the name, leaving code/city/state/pincode and
 *  the default flag untouched (the Settings → Company godown list offers rename
 *  only, so a full-row update would clobber the other fields). */
export async function renameLocation(sql: SqlClient, id: string, name: string) {
  if (!name.trim()) throw new ApiError("INVALID_FIELD", "Godown name is required.", 422);
  const rows = await sql`
    /* rename_stock_location */
    update stock_locations
    set name = ${name.trim()}, updated_at = now()
    where id = ${id}::uuid
    returning id
  `;
  if (rows.length === 0) throw new ApiError("NOT_FOUND", "Godown not found.", 404);
  const [out] = await sql`
    select l.id, l.name, l.code, l.city, l.state, l.state_code as "stateCode",
           l.pincode, l.is_default as "isDefault", l.status, 0 as "skuCount", 0 as "totalLitres"
    from stock_locations l where l.id = ${id}::uuid
  `;
  return mapLocation(out);
}

export async function updateLocation(sql: SqlClient, id: string, input: LocationInput) {
  // One transaction: clearing the previous default + applying this update must
  // not leave a window (or a failure) with no default godown.
  const stmts = [];
  if (input.isDefault) stmts.push(sql`update stock_locations set is_default = false where is_default and id <> ${id}::uuid`);
  stmts.push(sql`
    /* update_stock_location */
    update stock_locations
    set name = ${input.name.trim()}, code = ${input.code}, city = ${input.city},
        state = coalesce(${input.state}, state), state_code = coalesce(${input.stateCode}, state_code),
        pincode = ${input.pincode}, is_default = ${input.isDefault}, updated_at = now()
    where id = ${id}::uuid
    returning id
  `);
  const results = (await sql.transaction(stmts)) as unknown[][];
  const rows = results[results.length - 1];
  if (rows.length === 0) throw new ApiError("NOT_FOUND", "Godown not found.", 404);
  const [out] = await sql`
    select l.id, l.name, l.code, l.city, l.state, l.state_code as "stateCode",
           l.pincode, l.is_default as "isDefault", l.status, 0 as "skuCount", 0 as "totalLitres"
    from stock_locations l where l.id = ${id}::uuid
  `;
  return mapLocation(out);
}
