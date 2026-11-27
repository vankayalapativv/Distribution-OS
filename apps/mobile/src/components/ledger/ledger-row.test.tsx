import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LedgerRow } from "./ledger-row";
import type { LedgerRow as Row } from "../../lib/ledger";

const row = (over: Partial<Row> = {}): Row => ({
  type: "Sale",
  vchNo: "INV-100",
  date: "2026-11-27",
  particulars: "Order",
  narration: "Monthly order",
  debit: 5000,
  credit: null,
  balance: 5000,
  ...over,
});

describe("LedgerRow", () => {
  it("renders a sale with voucher, narration, amount and Dr balance", () => {
    render(<LedgerRow row={row()} />);
    expect(screen.getByText("INV-100")).toBeInTheDocument();
    expect(screen.getByText("SALE")).toBeInTheDocument();
    expect(screen.getByText("Monthly order")).toBeInTheDocument();
    expect(screen.getAllByText(/5,000/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Dr/)).toBeInTheDocument();
  });

  it("renders a receipt with the voucher fallback and credit amount", () => {
    render(<LedgerRow row={row({ type: "Rcpt", vchNo: null, debit: null, credit: 2000, balance: -2000, narration: "" })} />);
    expect(screen.getByText("Receipt")).toBeInTheDocument(); // vchNo fallback for a receipt
    expect(screen.getByText("RCPT")).toBeInTheDocument();
    expect(screen.getByText(/Bal .*Cr/)).toBeInTheDocument();
  });

  it("falls back to 'Invoice' for a sale with no voucher", () => {
    render(<LedgerRow row={row({ vchNo: null })} />);
    expect(screen.getByText("Invoice")).toBeInTheDocument();
  });

  it("shows the FIFO age chip in each tone", () => {
    const { rerender } = render(<LedgerRow row={row({ payoffDays: 12, paidOff: true })} />);
    expect(screen.getByText(/12 d/)).toBeInTheDocument(); // paid tone
    rerender(<LedgerRow row={row({ payoffDays: 12, partiallyPaid: true })} />);
    expect(screen.getByText(/Partially paid/)).toBeInTheDocument(); // partial tone
    rerender(<LedgerRow row={row({ payoffDays: 12 })} />);
    expect(screen.getByText(/Unpaid/)).toBeInTheDocument(); // unpaid tone
  });

  it("shows the pending-verification marker", () => {
    render(<LedgerRow row={row({ needsVerify: true })} />);
    expect(screen.getByText(/Pending verification/)).toBeInTheDocument();
  });

  it("shows ₹0 when both debit and credit are null", () => {
    render(<LedgerRow row={row({ debit: null, credit: null, balance: 0 })} />);
    expect(screen.getAllByText(/₹0/).length).toBeGreaterThan(0);
  });
});
