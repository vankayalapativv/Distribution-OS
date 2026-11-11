import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LedgerTableRow, isEditable } from "./ledger-table-row";
import type { LedgerRow } from "./ledger-types";

const row = (over: Partial<LedgerRow> = {}): LedgerRow =>
  ({ date: "2026-07-01", type: "Sale", vchNo: "INV-1", particulars: "Goods", narration: "n", debit: 100, credit: null, balance: 100, invoiceId: "inv1", ...over }) as LedgerRow;

const handlers = () => ({ onOpenInvoice: vi.fn(), onOpenProof: vi.fn(), onOpenReturnProof: vi.fn(), onEdit: vi.fn() });
const renderRow = (r: LedgerRow, h = handlers(), canEditEntries = true) => {
  render(<table><tbody><LedgerTableRow row={r} canViewProof canEditEntries={canEditEntries} handlers={h} /></tbody></table>);
  return h;
};

describe("isEditable", () => {
  it("covers collections and returns, but never Sale (invoice) rows", () => {
    // Sale rows are no longer edited from the ledger.
    expect(isEditable(row())).toBe(false);
    expect(isEditable(row({ type: "Rcpt", collectionId: "c1" }))).toBe(true);
    expect(isEditable(row({ type: "Rcpt", collectionId: undefined }))).toBe(false);
    expect(isEditable(row({ type: "Sale_re", returnId: "r1" }))).toBe(true);
    expect(isEditable(row({ type: "Sale_re", returnId: undefined }))).toBe(false);
  });
});

describe("LedgerTableRow", () => {
  it("opens the invoice PDF from the voucher link", () => {
    const h = renderRow(row());
    fireEvent.click(screen.getByRole("button", { name: "INV-1" }));
    expect(h.onOpenInvoice).toHaveBeenCalledWith("inv1");
  });

  it("shows an em dash for a receipt with no voucher and blanks null debit/credit", () => {
    renderRow(row({ type: "Rcpt", vchNo: null, invoiceId: undefined, collectionId: "c1", debit: null, credit: 50 }));
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("50.00")).toBeInTheDocument();
  });

  it("dispatches edit and only shows the pencil for editable rows with the right role", () => {
    const h = renderRow(row({ type: "Rcpt", vchNo: null, invoiceId: undefined, collectionId: "c1" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit entry" }));
    expect(h.onEdit).toHaveBeenCalledWith(expect.objectContaining({ collectionId: "c1" }));
  });

  it("never shows the edit pencil for a Sale (invoice) row", () => {
    renderRow(row());
    expect(screen.queryByRole("button", { name: "Edit entry" })).not.toBeInTheDocument();
  });

  it("hides the edit pencil when the role cannot edit", () => {
    renderRow(row({ type: "Rcpt", vchNo: null, invoiceId: undefined, collectionId: "c1" }), handlers(), false);
    expect(screen.queryByRole("button", { name: "Edit entry" })).not.toBeInTheDocument();
  });

  it("renders a payoff label for a settled sale", () => {
    renderRow(row({ payoffDays: 3, paidOff: true }));
    expect(screen.getByText("3 days")).toBeInTheDocument();
  });

  it("tints a negative (credit) balance green", () => {
    renderRow(row({ balance: -250 }));
    expect(screen.getByText("250.00 Cr").className).toContain("text-green-700");
  });
});
