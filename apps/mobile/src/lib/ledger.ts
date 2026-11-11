/**
 * Ledger types + a pure on-device range slicer. The app prefetches ONE full
 * (all-time) ledger per customer (bulk endpoint) and renders any preset range
 * offline by slicing locally — no per-range API call. Row balances are cumulative
 * over the whole history, so they stay correct within a slice; only the opening /
 * closing / totals are recomputed for the window.
 */
export interface LedgerRow {
  date: string;
  type: "Sale" | "Rcpt" | "Sale_re";
  vchNo: string | null;
  particulars: string;
  narration: string;
  debit: number | null;
  credit: number | null;
  balance: number;
  needsVerify?: boolean;
  payoffDays?: number | null;
  paidOff?: boolean;
  /** Sale rows, when not paidOff: caught a partial payment (FIFO) vs nothing yet. */
  partiallyPaid?: boolean;
  invoiceId?: string;
  collectionId?: string;
  returnId?: string;
  hasProof?: boolean;
}

export interface LedgerData {
  from: string;
  to: string;
  openingBalance: number;
  rows: LedgerRow[];
  totals: { debit: number; credit: number; closingBalance: number };
}

/** Slice a full ledger to a [from, to] window (yyyy-mm-dd, inclusive). */
export function sliceLedger(full: LedgerData, from: string, to: string): LedgerData {
  const before = full.rows.filter((r) => r.date < from);
  const rows = full.rows.filter((r) => r.date >= from && r.date <= to);
  const openingBalance =
    before.length > 0 ? before[before.length - 1].balance : full.openingBalance;
  const closingBalance = rows.length > 0 ? rows[rows.length - 1].balance : openingBalance;
  return {
    from,
    to,
    openingBalance,
    rows,
    totals: {
      debit: rows.reduce((s, r) => s + (r.debit ?? 0), 0),
      credit: rows.reduce((s, r) => s + (r.credit ?? 0), 0),
      closingBalance,
    },
  };
}
