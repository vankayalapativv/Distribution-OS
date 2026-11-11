/**
 * Oldest-first (FIFO) allocation of a collected amount across a customer's debts.
 *
 * This is the pure, DB-free core of how a verified collection is applied. It
 * mirrors the live behaviour today — auto-allocate oldest-due-first across
 * invoices (see reconcileCollection in collections.ts) — with ONE addition:
 * a per-customer OPENING BALANCE (a pre-system carry-forward, e.g. migrated
 * from BusyWin) is treated as the oldest debt and paid off FIRST, before any
 * invoice. When there is no opening balance the result is identical to the
 * present algorithm.
 *
 * Ordering:
 *   1. Opening balance (if outstanding > 0) — always first.
 *   2. Invoices, oldest-due-first: by (dueDate, createdAt) ascending — the same
 *      order the SQL `order by due_date, created_at` produces.
 *
 * Anything left over after every debt is cleared is returned as `leftover`
 * (held advance credit), exactly as an over-payment behaves today.
 */

export interface OpeningTarget {
  id: string;
  /** Remaining owed on the opening balance. */
  outstanding: number;
}

export interface InvoiceTarget {
  id: string;
  /** Remaining owed on the invoice. */
  outstanding: number;
  /** ISO date (yyyy-mm-dd) — primary FIFO key. */
  dueDate: string;
  /** ISO timestamp — tiebreaker when two invoices share a due date. */
  createdAt: string;
}

export interface FifoAllocation {
  kind: "opening" | "invoice";
  id: string;
  amount: number;
}

export interface FifoResult {
  allocations: FifoAllocation[];
  /** Unapplied money (over-payment) — becomes held advance credit. */
  leftover: number;
}

/** Round to 2 decimals (paise) to keep money math free of float drift. */
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Invoice FIFO comparator: due date first, then creation time. */
function byDueThenCreated(a: InvoiceTarget, b: InvoiceTarget): number {
  if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return 0;
}

/**
 * Allocate `amount` across the opening balance (first) then invoices (oldest
 * first). Pure: no DB, no mutation of inputs. Targets with outstanding <= 0 are
 * skipped. Never over-allocates a target beyond its outstanding.
 */
export function allocateOldestFirst(
  amount: number,
  opening: OpeningTarget | null,
  invoices: InvoiceTarget[],
): FifoResult {
  const allocations: FifoAllocation[] = [];
  let remaining = round2(amount);
  if (!(remaining > 0)) return { allocations, leftover: 0 };

  const take = (kind: "opening" | "invoice", id: string, outstanding: number): void => {
    if (remaining <= 0 || !(outstanding > 0)) return;
    const applied = round2(Math.min(remaining, outstanding));
    if (applied <= 0) return;
    allocations.push({ kind, id, amount: applied });
    remaining = round2(remaining - applied);
  };

  // 1. Opening balance is the oldest debt — always first.
  if (opening) take("opening", opening.id, opening.outstanding);

  // 2. Invoices, oldest-due-first (does not mutate the caller's array).
  for (const inv of [...invoices].sort(byDueThenCreated)) {
    if (remaining <= 0) break;
    take("invoice", inv.id, inv.outstanding);
  }

  return { allocations, leftover: round2(remaining) };
}

/** One explicit allocation to cap: the amount recorded against a specific
 *  invoice, plus that invoice's current outstanding (before this is applied). */
export interface ExplicitAllocation {
  invoiceId: string;
  /** Amount originally recorded against the invoice (the pre-cap request). */
  requested: number;
  /** The invoice's outstanding right now — the cap. */
  outstanding: number;
}

export interface CappedExplicit {
  invoiceId: string;
  /** Amount that actually fits and should be applied + stored. */
  applied: number;
  /** What to do with the stored allocation row vs the original `requested`:
   *  "unchanged" (fit exactly), "shrink" (fit partially), "delete" (fit none). */
  row: "unchanged" | "shrink" | "delete";
}

export interface CapAndSpillResult {
  capped: CappedExplicit[];
  /** Total that didn't fit any target — to be re-allocated oldest-first. */
  excess: number;
}

/**
 * Cap each explicit allocation at its invoice's outstanding, so a collection /
 * credit note recorded against a specific invoice can never over-fill it (which
 * would push `amount_collected` past the invoice value and strand the overflow).
 * The amount that doesn't fit is returned as `excess` for the caller to spill
 * oldest-first via {@link allocateOldestFirst}. Pure: no DB, no mutation.
 */
export function capAndSpillExplicit(allocations: ExplicitAllocation[]): CapAndSpillResult {
  const capped: CappedExplicit[] = [];
  let excess = 0;
  for (const a of allocations) {
    const requested = round2(a.requested);
    const outstanding = Math.max(0, round2(a.outstanding));
    const applied = round2(Math.min(requested, outstanding));
    let row: CappedExplicit["row"] = "unchanged";
    if (applied <= 0) row = "delete";
    else if (applied < requested - 0.005) row = "shrink";
    capped.push({ invoiceId: a.invoiceId, applied, row });
    excess = round2(excess + (requested - applied));
  }
  return { capped, excess: Math.max(0, excess) };
}
