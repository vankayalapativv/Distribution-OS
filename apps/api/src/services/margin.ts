import type { SqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";

/**
 * Margin Simulator (SUPER_ADMIN). Saved margin scenarios, oils only. Formula is
 * a faithful port of the client's margin_simulator.xlsx (kept identical to the
 * web `margin-calc.ts`):
 *   Margin/Pack  = (MOP − Scheme/L×Pack) − (DLP + Expense/L×Pack)
 *   Margin/Liter = Margin/Pack ÷ Pack
 * MRP and Coupon are stored for reference but do NOT enter the margin.
 */

type Row = Record<string, unknown>;
const str = (v: unknown): string => {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
};
const num = (v: unknown): number => (v == null ? 0 : Number(v));
const numOrNull = (v: unknown): number | null => (v == null || v === "" ? null : Number(v));

export interface MarginSimInput {
  productId: string | null;
  productName: string;
  packSize: number;
  mrp: number | null;
  dlp: number;
  expensePerLiter: number;
  schemePerLiter: number;
  coupon: number | null;
  mop: number;
}

/** The two output figures, from the locked sheet formula. */
export function marginOf(i: Pick<MarginSimInput, "packSize" | "dlp" | "expensePerLiter" | "schemePerLiter" | "mop">) {
  const marginPerPack = i.mop - i.schemePerLiter * i.packSize - (i.dlp + i.expensePerLiter * i.packSize);
  const marginPerLiter = i.packSize ? marginPerPack / i.packSize : 0;
  return { marginPerPack, marginPerLiter };
}

function mapRow(r: Row) {
  return {
    id: str(r.id),
    productId: r.productId ? str(r.productId) : null,
    productName: str(r.productName),
    packSize: num(r.packSize),
    mrp: numOrNull(r.mrp),
    dlp: num(r.dlp),
    expensePerLiter: num(r.expensePerLiter),
    schemePerLiter: num(r.schemePerLiter),
    coupon: numOrNull(r.coupon),
    mop: num(r.mop),
    marginPerPack: num(r.marginPerPack),
    marginPerLiter: num(r.marginPerLiter),
    createdAt: str(r.createdAt),
    updatedAt: str(r.updatedAt),
  };
}

const COLS = `
  id, product_id as "productId", product_name as "productName", pack_size_litres as "packSize",
  mrp, dlp, expense_per_liter as "expensePerLiter", scheme_per_liter as "schemePerLiter",
  coupon, mop, margin_per_pack as "marginPerPack", margin_per_liter as "marginPerLiter",
  created_at as "createdAt", updated_at as "updatedAt"`;

export async function listMarginSimulations(sql: SqlClient) {
  const rows = (await sql.query(
    `/* list_margin_simulations */ select ${COLS} from margin_simulations order by created_at desc`,
    [],
  )) as Row[];
  return rows.map(mapRow);
}

function validate(i: MarginSimInput) {
  if (!i.productName.trim()) throw new ApiError("INVALID_FIELD", "Pick a product.", 422);
  if (!(i.packSize > 0)) throw new ApiError("INVALID_FIELD", "Pack size must be greater than 0.", 422);
}

export async function createMarginSimulation(sql: SqlClient, ctx: { userId: string }, i: MarginSimInput) {
  validate(i);
  const m = marginOf(i);
  const rows = (await sql.query(
    `/* create_margin_simulation */
     insert into margin_simulations
       (product_id, product_name, pack_size_litres, mrp, dlp, expense_per_liter, scheme_per_liter,
        coupon, mop, margin_per_pack, margin_per_liter, created_by)
     values ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::uuid)
     returning ${COLS}`,
    [i.productId, i.productName, i.packSize, i.mrp, i.dlp, i.expensePerLiter, i.schemePerLiter,
      i.coupon, i.mop, m.marginPerPack, m.marginPerLiter, ctx.userId],
  )) as Row[];
  return mapRow(rows[0]);
}

export async function updateMarginSimulation(sql: SqlClient, id: string, i: MarginSimInput) {
  validate(i);
  const m = marginOf(i);
  const rows = (await sql.query(
    `/* update_margin_simulation */
     update margin_simulations set
       product_id = $1::uuid, product_name = $2, pack_size_litres = $3, mrp = $4, dlp = $5,
       expense_per_liter = $6, scheme_per_liter = $7, coupon = $8, mop = $9,
       margin_per_pack = $10, margin_per_liter = $11, updated_at = now()
     where id = $12::uuid
     returning ${COLS}`,
    [i.productId, i.productName, i.packSize, i.mrp, i.dlp, i.expensePerLiter, i.schemePerLiter,
      i.coupon, i.mop, m.marginPerPack, m.marginPerLiter, id],
  )) as Row[];
  if (!rows[0]) throw new ApiError("NOT_FOUND", "Simulation not found.", 404);
  return mapRow(rows[0]);
}

export async function deleteMarginSimulation(sql: SqlClient, id: string) {
  const rows = (await sql`/* delete_margin_simulation */ delete from margin_simulations where id = ${id}::uuid returning id`) as Row[];
  if (rows.length === 0) throw new ApiError("NOT_FOUND", "Simulation not found.", 404);
}
