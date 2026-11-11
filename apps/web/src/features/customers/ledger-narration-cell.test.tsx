import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LedgerNarrationCell } from "./ledger-narration-cell";
import type { LedgerRow } from "./ledger-types";

const row = (over: Partial<LedgerRow> = {}): LedgerRow =>
  ({ date: "2026-07-01", type: "Rcpt", vchNo: null, particulars: "", narration: "Cash", debit: null, credit: 100, balance: 0, ...over }) as LedgerRow;

const renderCell = (r: LedgerRow, canViewProof = true) => {
  const onOpenProof = vi.fn();
  const onOpenReturnProof = vi.fn();
  render(
    <table><tbody><tr><td>
      <LedgerNarrationCell row={r} canViewProof={canViewProof} onOpenProof={onOpenProof} onOpenReturnProof={onOpenReturnProof} />
    </td></tr></tbody></table>,
  );
  return { onOpenProof, onOpenReturnProof };
};

describe("LedgerNarrationCell", () => {
  it("opens a receipt proof for a Rcpt with proof", () => {
    const { onOpenProof } = renderCell(row({ hasProof: true, collectionId: "col1" }));
    fireEvent.click(screen.getByRole("button", { name: /Proof/ }));
    expect(onOpenProof).toHaveBeenCalledWith("col1");
  });
  it("opens a return proof for a Sale_re with proof", () => {
    const { onOpenReturnProof } = renderCell(row({ type: "Sale_re", hasProof: true, returnId: "r1" }));
    fireEvent.click(screen.getByRole("button", { name: /Proof/ }));
    expect(onOpenReturnProof).toHaveBeenCalledWith("r1");
  });
  it("hides the proof button when the viewer cannot see proofs", () => {
    renderCell(row({ hasProof: true, collectionId: "col1" }), false);
    expect(screen.queryByRole("button", { name: /Proof/ })).not.toBeInTheDocument();
  });
  it("shows the needs-verify badge for unverified receipts", () => {
    renderCell(row({ needsVerify: true }));
    expect(screen.getByText("Needs to verify")).toBeInTheDocument();
  });
  it("renders just the narration for a plain sale", () => {
    renderCell(row({ type: "Sale", narration: "Invoice" }));
    expect(screen.getByText("Invoice")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
