import type { SqlClient } from "../lib/db";

/**
 * Deterministic per-invoice balance recompute (2026-08-22, Layer 2).
 *
 * The customer's TOTAL balance is already the stateless ledger figure
 * (COLLECTION_DUES_EXPR / kpi_outstanding). This module makes the PER-INVOICE
 * `outstanding_amount` agree with that total so the ageing views (overdue,
 * dues-buckets, oldest-unpaid, credit-gate) sum to the ledger balance instead
 * of drifting.
 *
 * Model (agreed with the client): a customer's non-rejected collections are one
 * credit pool applied OLDEST-DEBT-FIRST — opening balance, then invoices by due
 * date. Sales returns lower a specific invoice's debt first. Money is handled in
 * integer paise so there is no float drift. Idempotent: running it any number of
 * times yields the same result, which is why it can safely run after every
 * mutation and as a one-time repair.
 */

export type PaymentStatus = "paid" | "partially_paid" | "unpaid";

export interface RecomputeInvoiceInput {
  id: string;
  netPaise: number;
  returnedPaise: number;
  dueDate: string | null;
  createdAt: string;
}

export interface RecomputeInvoiceOut {
  id: string;
  amountCollectedPaise: number;
  outstandingPaise: number;
  paymentStatus: PaymentStatus;
}

export interface RecomputeResult {
  openingCollectedPaise: number;
  openingOutstandingPaise: number;
  invoices: RecomputeInvoiceOut[];
  /** Verified/pending money left after every debt is cleared = customer credit. */
  heldCreditPaise: number;
}

export const toPaise = (rupees: number): number => Math.round(rupees * 100);
export const fromPaise = (paise: number): number => Math.round(paise) / 100;

/** Oldest debt first: by due date (null last), then creation, then id. */
function debtOrder(a: RecomputeInvoiceInput, b: RecomputeInvoiceInput): number {
  const ad = a.dueDate ?? "9999-12-31";
  const bd = b.dueDate ?? "9999-12-31";
  if (ad !== bd) return ad < bd ? -1 : 1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id < b.id ? -1 : 1;
}

function statusFor(outstandingPaise: number, collectedPaise: number): PaymentStatus {
  if (outstandingPaise <= 0) return "paid";
  if (collectedPaise > 0) return "partially_paid";
  return "unpaid";
}

/**
 * Pure recompute — no I/O, no clock. `creditPoolPaise` = Σ non-rejected
 * collection amounts; the opening balance is the oldest debt.
 */
export function recomputeAggregates(input: {
  openingAmountPaise: number;
  creditPoolPaise: number;
  invoices: RecomputeInvoiceInput[];
}): RecomputeResult {
  let credit = Math.max(0, input.creditPoolPaise);

  const openingDebt = Math.max(0, input.openingAmountPaise);
  const openingApplied = Math.min(credit, openingDebt);
  credit -= openingApplied;

  const invoices = [...input.invoices].sort(debtOrder).map((inv) => {
    const debt = Math.max(0, inv.netPaise - inv.returnedPaise);
    const applied = Math.min(credit, debt);
    credit -= applied;
    const outstanding = Math.max(0, debt - applied);
    return {
      id: inv.id,
      amountCollectedPaise: applied,
      outstandingPaise: outstanding,
      paymentStatus: statusFor(outstanding, applied),
    };
  });

  return {
    openingCollectedPaise: openingApplied,
    openingOutstandingPaise: Math.max(0, openingDebt - openingApplied),
    invoices,
    heldCreditPaise: Math.max(0, credit),
  };
}

const num = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v !== "") return Number(v);
  return 0;
};
const str = (v: unknown): string => {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return v == null ? "" : String(v);
};
const dateStr = (v: unknown): string | null => {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") return v.slice(0, 10);
  return null;
};

/**
 * Recompute one customer's per-invoice `outstanding_amount` / `amount_collected`
 * / `payment_status` and their opening balance, from ground truth, in ONE
 * transaction. Call it after any mutation that changes a customer's invoices,
 * collections or sales returns (and from the one-time repair). Non-rejected
 * collections/invoices only; sales returns are per-invoice.
 */
export async function recomputeCustomerBalances(
  sql: SqlClient,
  customerId: string,
): Promise<void> {
  const [openRow] = (await sql`
    /* recompute_opening */
    select id, opening_amount as "openingAmount"
    from customer_opening_balances where customer_id = ${customerId}::uuid
  `) as Record<string, unknown>[];

  const invoiceRows = (await sql`
    /* recompute_invoices */
    select
      i.id, i.invoice_net_value as "net",
      coalesce((select sum(sr.gross_amount) from sales_returns sr where sr.invoice_id = i.id), 0) as "returned",
      i.due_date as "dueDate", i.created_at as "createdAt"
    from invoices i
    where i.customer_id = ${customerId}::uuid and i.approval_status <> 'rejected' and i.doc_status <> 'cancelled'
  `) as Record<string, unknown>[];

  const [creditRow] = (await sql`
    /* recompute_credit_pool */
    select coalesce(sum(collection_amount), 0) as "pool"
    from collections
    where customer_id = ${customerId}::uuid and accountant_approval_status is distinct from 'rejected'
  `) as Record<string, unknown>[];

  const result = recomputeAggregates({
    openingAmountPaise: openRow ? toPaise(num(openRow.openingAmount)) : 0,
    creditPoolPaise: toPaise(num(creditRow?.pool)),
    invoices: invoiceRows.map((r) => ({
      id: str(r.id),
      netPaise: toPaise(num(r.net)),
      returnedPaise: toPaise(num(r.returned)),
      dueDate: dateStr(r.dueDate),
      createdAt: str(r.createdAt),
    })),
  });

  const statements = result.invoices.map(
    (b) => sql`
      /* recompute_write_invoice */
      update invoices set
        outstanding_amount = ${fromPaise(b.outstandingPaise)},
        amount_collected   = ${fromPaise(b.amountCollectedPaise)},
        payment_status     = ${b.paymentStatus},
        updated_at = now()
      where id = ${b.id}::uuid
    `,
  );
  if (openRow) {
    statements.push(sql`
      /* recompute_write_opening */
      update customer_opening_balances set
        outstanding_amount = ${fromPaise(result.openingOutstandingPaise)},
        amount_collected   = ${fromPaise(result.openingCollectedPaise)},
        updated_at = now()
      where id = ${str(openRow.id)}::uuid
    `);
  }
  // Cancelled invoices are excluded from the debt pool above, so they are never
  // written by the per-invoice update. Zero them here so a cancelled invoice can
  // never hold a stale outstanding balance (which would leak into dues/outstanding
  // and the "owes" views). Self-healing + idempotent.
  statements.push(sql`
    /* recompute_zero_cancelled */
    update invoices set
      outstanding_amount = 0, amount_collected = 0, payment_status = 'unpaid', updated_at = now()
    where customer_id = ${customerId}::uuid and doc_status = 'cancelled'
      and (outstanding_amount <> 0 or amount_collected <> 0)
  `);
  if (statements.length > 0) await sql.transaction(statements);
}
