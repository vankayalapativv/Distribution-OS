export interface LedgerRow {
  date: string;
  type: "Sale" | "Rcpt" | "Sale_re";
  vchNo: string | null;
  particulars: string;
  narration: string;
  debit: number | null;
  credit: number | null;
  balance: number;
  invoiceId?: string;
  collectionId?: string;
  returnId?: string;
  hasProof?: boolean;
  /** Rcpt rows: collection still pending accountant verification. */
  needsVerify?: boolean;
  /** Sale rows: days to fully pay off (paidOff) or days outstanding so far. */
  payoffDays?: number | null;
  paidOff?: boolean;
  /** Sale rows, when not paidOff: caught a partial payment (FIFO) vs nothing yet. */
  partiallyPaid?: boolean;
}

export interface LedgerData {
  from: string;
  to: string;
  openingBalance: number;
  rows: LedgerRow[];
  totals: { debit: number; credit: number; closingBalance: number };
}

export type LedgerRole = "SUPER_ADMIN" | "MANAGER" | "ACCOUNTANT";

export interface LedgerActions {
  canCreateOrder: boolean;
  canCreateCollection: boolean;
  canCreateReturn: boolean;
  canCreateCreditNote: boolean;
  canManageOpening: boolean;
  onReturn: () => void;
  onCreditNote: () => void;
  onOpening: () => void;
  onDownload: () => void;
  downloadDisabled: boolean;
  downloading: boolean;
}

/** Sale-row label for the "Paid off" column: "12 days" when settled, else the
 *  days it's been outstanding, flagged. Blank for receipts. */
export function payoffLabel(
  row: LedgerRow,
): { text: string; tone: "paid" | "partial" | "unpaid" } | null {
  if (row.type !== "Sale" || row.payoffDays == null) return null;
  const d = row.payoffDays;
  const dayWord = `${d} day${d === 1 ? "" : "s"}`;
  if (row.paidOff) return { text: dayWord, tone: "paid" };
  // Under FIFO only the oldest still-unpaid invoice can catch a partial payment;
  // every Sale after it has received nothing → "Unpaid" (a distinct colour).
  return row.partiallyPaid
    ? { text: `${dayWord} · Partially paid`, tone: "partial" }
    : { text: `${dayWord} · Unpaid`, tone: "unpaid" };
}

/** Indian-grouped amount, 2dp, no ₹ (matches the ledger PDF: "66,040.00"). */
export function amt(n: number): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Running balance shown as "X Dr" (owes) / "X Cr" (advance). */
export function balanceLabel(n: number): string {
  if (Math.abs(n) < 0.005) return "0.00";
  return `${amt(Math.abs(n))} ${n >= 0 ? "Dr" : "Cr"}`;
}

export function fmtDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}-${m}-${y}`;
}

/** Grand-total debit / credit — opening + period totals + the closing carry. */
export function grandTotalDebit(data: LedgerData): number {
  return Math.max(0, data.openingBalance) + data.totals.debit + Math.max(0, -data.totals.closingBalance);
}
export function grandTotalCredit(data: LedgerData): number {
  return Math.max(0, -data.openingBalance) + data.totals.credit + Math.max(0, data.totals.closingBalance);
}

/** Which ledger actions a role may take (see AGENTS role rules). */
export function ledgerPermissions(role: LedgerRole) {
  return {
    canViewProof: role !== "MANAGER",
    canCreateCreditNote: true, // all three office roles
    canCreateReturn: role === "SUPER_ADMIN" || role === "ACCOUNTANT",
    canManageOpening: role === "SUPER_ADMIN" || role === "ACCOUNTANT",
    canEditEntries: role === "SUPER_ADMIN",
    canCreateOrder: role === "SUPER_ADMIN" || role === "MANAGER",
    canCreateCollection: true, // all three office roles
  };
}
