import { describe, expect, it } from "vitest";
import { ageLabel, balanceLabel, fmtDate, rupees } from "./ledger-format";
import type { LedgerRow } from "./ledger";

function saleRow(over: Partial<LedgerRow> = {}): LedgerRow {
  return {
    date: "2026-07-20",
    type: "Sale",
    vchNo: "A2",
    particulars: "Cr",
    narration: "Sales",
    debit: 500,
    credit: null,
    balance: 500,
    ...over,
  };
}

describe("rupees", () => {
  it("formats with the Indian grouping and a ₹ prefix", () => {
    expect(rupees(1234567.5)).toBe("₹12,34,567.5");
  });
  it("uses the absolute value (sign is shown elsewhere)", () => {
    expect(rupees(-500)).toBe("₹500");
  });
  it("caps at two fraction digits", () => {
    expect(rupees(10.129)).toBe("₹10.13");
  });
});

describe("balanceLabel", () => {
  it("labels a positive balance as Dr (customer owes)", () => {
    expect(balanceLabel(600)).toEqual({ text: "₹600 Dr", dr: true });
  });
  it("labels a negative balance as Cr (advance)", () => {
    expect(balanceLabel(-200)).toEqual({ text: "₹200 Cr", dr: false });
  });
  it("treats zero as Dr", () => {
    expect(balanceLabel(0)).toEqual({ text: "₹0 Dr", dr: true });
  });
});

describe("fmtDate", () => {
  it("renders the date part as d MMM yyyy (ignoring any time suffix)", () => {
    const out = fmtDate("2026-07-15T09:30:00.000Z");
    expect(out).toMatch(/15/);
    expect(out).toMatch(/Jul/);
    expect(out).toMatch(/2026/);
  });
});

describe("ageLabel", () => {
  it("returns null for a non-Sale row", () => {
    expect(ageLabel(saleRow({ type: "Rcpt" }))).toBeNull();
  });
  it("returns null for a Sale row with no payoffDays", () => {
    expect(ageLabel(saleRow({ payoffDays: null }))).toBeNull();
    expect(ageLabel(saleRow({ payoffDays: undefined }))).toBeNull();
  });
  it("marks a settled Sale as paid", () => {
    expect(ageLabel(saleRow({ payoffDays: 12, paidOff: true }))).toEqual({
      text: "12 d",
      tone: "paid",
    });
  });
  it("marks the FIFO boundary Sale as partially paid", () => {
    expect(ageLabel(saleRow({ payoffDays: 20, paidOff: false, partiallyPaid: true }))).toEqual({
      text: "20 d · Partially paid",
      tone: "partial",
    });
  });
  it("marks an untouched Sale as unpaid", () => {
    expect(ageLabel(saleRow({ payoffDays: 45, paidOff: false, partiallyPaid: false }))).toEqual({
      text: "45 d · Unpaid",
      tone: "unpaid",
    });
  });
});
