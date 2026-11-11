/**
 * Pure formatting helpers for the customer ledger rows/header — rupee amounts,
 * Dr/Cr balance labels, dates, and the FIFO ageing chip for Sale rows.
 */
import type { LedgerRow } from "./ledger";

export function rupees(n: number): string {
  return `₹${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/** Running balance as "₹X Dr" (owes) / "₹X Cr" (advance). */
export function balanceLabel(n: number): { text: string; dr: boolean } {
  return { text: `${rupees(n)} ${n >= 0 ? "Dr" : "Cr"}`, dr: n >= 0 };
}

export function fmtDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Sale-row ageing chip: "12 d" when settled, else "N d · Partially paid" for
 *  the FIFO boundary invoice, or "N d · Unpaid" for ones nothing has reached. */
export function ageLabel(
  r: LedgerRow,
): { text: string; tone: "paid" | "partial" | "unpaid" } | null {
  if (r.type !== "Sale" || r.payoffDays == null) return null;
  const word = `${r.payoffDays} d`;
  if (r.paidOff) return { text: word, tone: "paid" };
  return r.partiallyPaid
    ? { text: `${word} · Partially paid`, tone: "partial" }
    : { text: `${word} · Unpaid`, tone: "unpaid" };
}
