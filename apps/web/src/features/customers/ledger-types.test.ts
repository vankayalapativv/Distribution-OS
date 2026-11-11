import { describe, expect, it } from "vitest";
import {
  amt,
  balanceLabel,
  fmtDate,
  grandTotalCredit,
  grandTotalDebit,
  ledgerPermissions,
  payoffLabel,
  type LedgerData,
  type LedgerRow,
} from "./ledger-types";

const sale = (over: Partial<LedgerRow> = {}): LedgerRow =>
  ({ date: "2026-07-01", type: "Sale", vchNo: "INV-1", particulars: "", narration: "", debit: 100, credit: null, balance: 100, payoffDays: 5, ...over }) as LedgerRow;

describe("payoffLabel", () => {
  it("returns null for non-Sale rows or missing payoffDays", () => {
    expect(payoffLabel(sale({ type: "Rcpt" }))).toBeNull();
    expect(payoffLabel(sale({ payoffDays: null }))).toBeNull();
  });
  it("labels paid, partial and unpaid sales (pluralizing days)", () => {
    expect(payoffLabel(sale({ paidOff: true, payoffDays: 1 }))).toEqual({ text: "1 day", tone: "paid" });
    expect(payoffLabel(sale({ paidOff: false, partiallyPaid: true }))).toEqual({ text: "5 days · Partially paid", tone: "partial" });
    expect(payoffLabel(sale({ paidOff: false, partiallyPaid: false }))).toEqual({ text: "5 days · Unpaid", tone: "unpaid" });
  });
});

describe("amt / balanceLabel / fmtDate", () => {
  it("formats amounts Indian-grouped with 2dp", () => {
    expect(amt(66040)).toBe("66,040.00");
  });
  it("labels balances Dr / Cr / zero", () => {
    expect(balanceLabel(500)).toBe("500.00 Dr");
    expect(balanceLabel(-500)).toBe("500.00 Cr");
    expect(balanceLabel(0)).toBe("0.00");
    expect(balanceLabel(0.001)).toBe("0.00"); // within epsilon
  });
  it("reformats an ISO date to dd-mm-yyyy", () => {
    expect(fmtDate("2026-07-01")).toBe("01-07-2026");
  });
});

describe("grand totals", () => {
  const data = (opening: number, closing: number): LedgerData => ({
    from: "2026-07-01",
    to: "2026-07-31",
    openingBalance: opening,
    rows: [],
    totals: { debit: 1000, credit: 400, closingBalance: closing },
  });
  it("adds the positive opening + debit + positive closing-credit carry", () => {
    expect(grandTotalDebit(data(200, -50))).toBe(200 + 1000 + 50);
    expect(grandTotalCredit(data(200, -50))).toBe(0 + 400 + 0);
  });
  it("handles a credit opening and a debit closing", () => {
    expect(grandTotalDebit(data(-200, 50))).toBe(0 + 1000 + 0);
    expect(grandTotalCredit(data(-200, 50))).toBe(200 + 400 + 50);
  });
});

describe("ledgerPermissions", () => {
  it("gives super admins every capability", () => {
    const p = ledgerPermissions("SUPER_ADMIN");
    expect(p).toMatchObject({ canViewProof: true, canCreateReturn: true, canManageOpening: true, canEditEntries: true, canCreateOrder: true });
  });
  it("limits managers (no proof, no return/opening/edit, can order)", () => {
    const p = ledgerPermissions("MANAGER");
    expect(p).toMatchObject({ canViewProof: false, canCreateReturn: false, canManageOpening: false, canEditEntries: false, canCreateOrder: true });
  });
  it("limits accountants (proof + return/opening, no edit, no order)", () => {
    const p = ledgerPermissions("ACCOUNTANT");
    expect(p).toMatchObject({ canViewProof: true, canCreateReturn: true, canManageOpening: true, canEditEntries: false, canCreateOrder: false });
  });
});
