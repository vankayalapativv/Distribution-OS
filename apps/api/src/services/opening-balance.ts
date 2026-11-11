import type { SqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";

/**
 * Per-customer OPENING BALANCE (migration 0066). A pre-system carry-forward debt
 * that is NOT a real invoice, but is treated as the customer's OLDEST debt: a
 * verified collection pays it off FIRST, then invoices (see collections.ts /
 * opening-balance-fifo.ts). `as_of_date` ages it in the dues buckets.
 *
 * Permissions (enforced here, route also gates the roles):
 *   • ACCOUNTANT — may CREATE it once (only when none exists); cannot edit after.
 *   • SUPER_ADMIN — may create, edit, or clear it anytime.
 */

type Row = Record<string, unknown>;
const str = (v: unknown): string => {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
};
const num = (v: unknown): number => (v == null ? 0 : Number(v));

export type OpeningBalanceRole = "SUPER_ADMIN" | "ACCOUNTANT";

export interface OpeningBalance {
  id: string;
  customerId: string;
  asOfDate: string;
  openingAmount: number;
  amountCollected: number;
  outstandingAmount: number;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OpeningBalanceInput {
  asOfDate: string;
  openingAmount: number;
  remarks: string | null;
}

function mapRow(r: Row): OpeningBalance {
  return {
    id: str(r.id),
    customerId: str(r.customerId),
    asOfDate: str(r.asOfDate).slice(0, 10),
    openingAmount: num(r.openingAmount),
    amountCollected: num(r.amountCollected),
    outstandingAmount: num(r.outstandingAmount),
    remarks: r.remarks == null ? null : str(r.remarks),
    createdAt: str(r.createdAt),
    updatedAt: str(r.updatedAt),
  };
}

/** The customer's opening balance, or null if none is set. */
export async function getOpeningBalance(
  sql: SqlClient,
  customerId: string,
): Promise<OpeningBalance | null> {
  const rows = (await sql`
    /* get_opening_balance */
    select
      id, customer_id as "customerId", as_of_date as "asOfDate",
      opening_amount as "openingAmount", amount_collected as "amountCollected",
      outstanding_amount as "outstandingAmount", remarks,
      created_at as "createdAt", updated_at as "updatedAt"
    from customer_opening_balances
    where customer_id = ${customerId}::uuid
  `) as Row[];
  return rows[0] ? mapRow(rows[0]) : null;
}

/** FIFO target: the opening balance's id + remaining outstanding, or null. */
export async function getOpeningTarget(
  sql: SqlClient,
  customerId: string,
): Promise<{ id: string; outstanding: number } | null> {
  const rows = (await sql`
    /* get_opening_target */
    select id, outstanding_amount as "outstanding"
    from customer_opening_balances
    where customer_id = ${customerId}::uuid and outstanding_amount > 0
  `) as Row[];
  return rows[0] ? { id: str(rows[0].id), outstanding: num(rows[0].outstanding) } : null;
}

/** Apply money to the opening balance (mirrors applyAllocationToInvoice). */
export async function applyAllocationToOpening(
  sql: SqlClient,
  openingId: string,
  amount: number,
): Promise<void> {
  await sql`
    /* apply_allocation_to_opening */
    update customer_opening_balances
    set amount_collected   = amount_collected + ${amount},
        outstanding_amount = greatest(0, outstanding_amount - ${amount}),
        updated_at = now()
    where id = ${openingId}::uuid
  `;
}

/** Reverse money from the opening balance (mirrors reverse_allocation_from_invoice). */
export async function reverseAllocationFromOpening(
  sql: SqlClient,
  openingId: string,
  amount: number,
): Promise<void> {
  await sql`
    /* reverse_allocation_from_opening */
    update customer_opening_balances
    set amount_collected   = greatest(0, amount_collected - ${amount}),
        outstanding_amount = outstanding_amount + ${amount},
        updated_at = now()
    where id = ${openingId}::uuid
  `;
}

/**
 * Free `excess` worth of the opening balance's applied allocations back to held
 * credit (newest first), lowering amount_collected. The freed credit is NOT
 * re-applied here — the caller runs applyHeldCreditToOpenInvoices afterwards.
 * Used when the amount is edited below what has already been collected, and when
 * clearing a partly-paid opening.
 */
/**
 * Create or update the opening balance, then RE-RECONCILE the customer so all
 * their verified collections re-apply oldest-first with the opening included
 * (`reReconcile`). This is what makes historical payments clear the opening — the
 * genuinely-oldest debt — first, and it keeps amount_collected/outstanding on the
 * opening row correct without any ad-hoc allocation surgery here. Returns the
 * freshly-reconciled row.
 */
export async function upsertOpeningBalance(
  sql: SqlClient,
  context: { userId: string; role: OpeningBalanceRole },
  customerId: string,
  input: OpeningBalanceInput,
  reReconcile: () => Promise<void>,
): Promise<OpeningBalance> {
  const amount = Number(input.openingAmount);
  if (!(amount >= 0)) throw new ApiError("INVALID_FIELD", "Amount can't be negative.", 422);
  if (!input.asOfDate) throw new ApiError("INVALID_FIELD", "Pick an as-of date.", 422);

  const existing = await getOpeningBalance(sql, customerId);
  if (existing && context.role !== "SUPER_ADMIN") {
    throw new ApiError(
      "FORBIDDEN",
      "An opening balance already exists. Only a Super Admin can edit it.",
      403,
    );
  }

  if (!existing) {
    await sql`
      /* create_opening_balance */
      insert into customer_opening_balances
        (customer_id, as_of_date, opening_amount, amount_collected, outstanding_amount, remarks, created_by, updated_by)
      values (${customerId}::uuid, ${input.asOfDate}::date, ${amount}, 0, ${amount}, ${input.remarks}, ${context.userId}::uuid, ${context.userId}::uuid)
    `;
  } else {
    // amount_collected/outstanding are recomputed by reReconcile — set the fields
    // the admin edits here.
    await sql`
      /* update_opening_balance */
      update customer_opening_balances set
        as_of_date = ${input.asOfDate}::date,
        opening_amount = ${amount},
        remarks = ${input.remarks},
        updated_by = ${context.userId}::uuid,
        updated_at = now()
      where customer_id = ${customerId}::uuid
    `;
  }

  await reReconcile();
  const saved = await getOpeningBalance(sql, customerId);
  if (!saved) throw new ApiError("NOT_FOUND", "Opening balance not found.", 404);
  return saved;
}

/**
 * Clear (remove) the opening balance — SUPER_ADMIN only. Its allocations are
 * dropped and the row deleted, then the customer is re-reconciled so those
 * collections re-apply to the invoices (opening gone).
 */
export async function clearOpeningBalance(
  sql: SqlClient,
  context: { userId: string; role: OpeningBalanceRole },
  customerId: string,
  reReconcile: () => Promise<void>,
): Promise<void> {
  if (context.role !== "SUPER_ADMIN") {
    throw new ApiError("FORBIDDEN", "Only a Super Admin can clear an opening balance.", 403);
  }
  const existing = await getOpeningBalance(sql, customerId);
  if (!existing) return;
  // Drop the opening's allocations AND the row in ONE transaction, then
  // re-reconcile so the freed money re-applies to the invoices. Batching the two
  // deletes stops a crash between them from leaving the opening row with its
  // allocations already gone (an inconsistent, un-reconcilable state).
  await sql.transaction([
    sql`/* drop_opening_allocations */ delete from collection_allocations where opening_balance_id = ${existing.id}::uuid`,
    sql`/* delete_opening_balance */ delete from customer_opening_balances where id = ${existing.id}::uuid`,
  ]);
  await reReconcile();
}
