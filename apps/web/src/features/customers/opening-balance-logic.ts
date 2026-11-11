import type { CustomerDetailRole } from "./customer-detail";

/** A customer's opening balance (pre-system carry-forward), or null when unset. */
export interface OpeningBalance {
  id: string;
  asOfDate: string;
  openingAmount: number;
  amountCollected: number;
  outstandingAmount: number;
  remarks: string | null;
}

export function todayIso(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** Accountant may CREATE once (only when none exists); SUPER_ADMIN may edit/clear. */
export function isLocked(initial: OpeningBalance | null, role: CustomerDetailRole): boolean {
  return initial != null && role !== "SUPER_ADMIN";
}

export function canClearOpening(initial: OpeningBalance | null, role: CustomerDetailRole): boolean {
  return initial != null && role === "SUPER_ADMIN";
}

/** Validate the entered amount + date. Returns { value } or an error string. */
export function validateOpening(amount: string, asOfDate: string): { value: number } | { error: string } {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) return { error: "Enter a valid amount (0 or more)." };
  if (!asOfDate) return { error: "Pick an as-of date." };
  return { value };
}
