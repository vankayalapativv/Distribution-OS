/**
 * Shared helpers for the Stock Journal (migration 0004).
 *
 * The stock ledger (`stock_movements`) is the append-only source of truth; every
 * write also upserts the `stock_balances` cache in the SAME batch so reads are
 * fast and the cache stays in step. SKUs are the existing catalogue —
 * products(id) × product_packs.pack_size_litres — never a new master here.
 */
import type { SqlClient } from "../lib/db";
import { num, str } from "./orders-shared";

export type { Row } from "./orders-shared";
export { num, str } from "./orders-shared";

/** A PostgreSQL `date` (JS Date under Neon) or string → yyyy-mm-dd. */
export function dateIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") return v.slice(0, 10);
  return "";
}

/** Indian financial-year label for a yyyy-mm-dd date (Apr–Mar). 2026-10-31 → "2026-27". */
export function finYearOf(dateYmd: string): string {
  const [y, m] = dateYmd.split("-").map(Number);
  const startYear = m >= 4 ? y : y - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/** Company's own GST state code (single-client, Telangana). Compared to the
 *  buyer's state to decide CGST+SGST (intra) vs IGST (inter). */
export const COMPANY_STATE_CODE = "36";

export type MovementKind =
  | "opening"
  | "grn"
  | "sale"
  | "sale_reversal"
  | "transfer_in"
  | "transfer_out"
  | "adjustment"
  | "return";

export interface MovementInput {
  locationId: string;
  productId: string;
  packSizeLitres: number;
  brand: string | null;
  /** Signed: +in / -out. */
  qtyUnits: number;
  kind: MovementKind;
  refType: string | null;
  refId: string | null;
  /** The batch lot this movement draws from / adds to (Phase 2). Null = pre-batch
   *  or a flow not yet lot-aware. */
  batchId?: string | null;
  note: string | null;
  /** Business date (yyyy-mm-dd) for the ledger entry. Today → real now() (keeps
   *  intra-day order); a past date → noon IST of that day; omitted/null → now(). */
  movedAt?: string | null;
}

/** Round to 2 dp the way money/qty is stored (avoids JS float drift in display). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** One `stock_movements` insert statement (signed qty + derived signed litres). */
export function movementStmt(sql: SqlClient, m: MovementInput, userId: string) {
  const litres = round2(m.qtyUnits * m.packSizeLitres);
  const movedAt = m.movedAt ?? null;
  return sql`
    /* stock_movement */
    insert into stock_movements
      (location_id, product_id, pack_size_litres, brand, qty_units, litres, kind, ref_type, ref_id, batch_id, note, moved_at, created_by)
    values
      (${m.locationId}::uuid, ${m.productId}::uuid, ${m.packSizeLitres}, ${m.brand},
       ${m.qtyUnits}, ${litres}, ${m.kind}, ${m.refType}, ${m.refId}::uuid, ${m.batchId ?? null}::uuid, ${m.note},
       (case
          when ${movedAt}::date is null then now()
          when ${movedAt}::date = (now() at time zone 'Asia/Kolkata')::date then now()
          else (${movedAt}::date + interval '12 hours') at time zone 'Asia/Kolkata'
        end),
       ${userId}::uuid)
  `;
}

/** One `stock_balances` change applying a signed delta.
 *
 *  A DECREMENT (delta < 0) is a plain UPDATE: the balance row always pre-exists
 *  (callers hard-block / pre-check that there is stock to take), and an UPDATE
 *  avoids a Postgres gotcha — `INSERT … ON CONFLICT DO UPDATE` evaluates the
 *  table's CHECK against the *proposed insert row*, so inserting a negative
 *  candidate would trip `qty_units >= 0` before the conflict resolves to the
 *  (valid) UPDATE. The non-negative CHECK still fires on the UPDATE result, so an
 *  over-decrement aborts the batch (the hard-block backstop).
 *
 *  An INCREMENT (delta >= 0) upserts: the row may not exist yet (opening stock,
 *  a GRN or a transfer into a fresh SKU/location), and the candidate is >= 0. */
export function balanceStmt(
  sql: SqlClient,
  b: { locationId: string; productId: string; packSizeLitres: number; delta: number },
) {
  if (b.delta < 0) {
    return sql`
      /* stock_balance_decrement */
      update stock_balances
      set qty_units = qty_units + ${b.delta}, updated_at = now()
      where location_id = ${b.locationId}::uuid and product_id = ${b.productId}::uuid
        and pack_size_litres = ${b.packSizeLitres}
    `;
  }
  return sql`
    /* stock_balance_upsert */
    insert into stock_balances (location_id, product_id, pack_size_litres, qty_units, updated_at)
    values (${b.locationId}::uuid, ${b.productId}::uuid, ${b.packSizeLitres}, ${b.delta}, now())
    on conflict (location_id, product_id, pack_size_litres)
    do update set qty_units = stock_balances.qty_units + ${b.delta}, updated_at = now()
  `;
}

/** One `stock_lots` cached-qty change applying a signed delta to a known lot (the
 *  lot row always pre-exists — `ensureLots` created it before the movement). The
 *  lot's `qty_units >= 0` CHECK is the per-batch over-decrement backstop. */
export function lotBalanceStmt(sql: SqlClient, lotId: string, delta: number) {
  return sql`
    /* stock_lot_balance */
    update stock_lots set qty_units = qty_units + ${delta}, updated_at = now()
    where id = ${lotId}::uuid
  `;
}

/** A doc line that moves stock. */
export interface StockLineInput {
  productId: string;
  packSizeLitres: number;
  brand: string | null;
  qtyUnits: number;
}

/** Map a balance row (catalogue × location) to the API shape. */
/** Coerce a product's `unit` column to the two valid values (piece-sold =
 *  'quantity', everything else 'litres'). Drives the "pcs" vs "N L" display. */
export function stockUnit(v: unknown): "litres" | "quantity" {
  return v === "quantity" ? "quantity" : "litres";
}

export function mapBalanceRow(r: Record<string, unknown>) {
  const qty = num(r.qtyUnits);
  const pack = num(r.packSizeLitres);
  return {
    locationId: str(r.locationId),
    locationName: str(r.locationName),
    productId: str(r.productId),
    productName: str(r.productName),
    brand: r.brand == null ? null : str(r.brand),
    segment: r.segment == null ? null : str(r.segment),
    packSizeLitres: pack,
    unit: stockUnit(r.unit),
    qtyUnits: qty,
    litres: round2(qty * pack),
    reorderLevel: r.reorderLevel == null ? null : num(r.reorderLevel),
    belowReorder: r.reorderLevel != null && qty < num(r.reorderLevel),
  };
}
