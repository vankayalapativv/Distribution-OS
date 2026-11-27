import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LedgerBody } from "./ledger-body";
import type { LedgerData } from "../../lib/ledger";

const data = (rows: LedgerData["rows"]): LedgerData => ({
  from: "2026-11-01",
  to: "2026-11-30",
  openingBalance: 1000,
  rows,
  totals: { debit: 5000, credit: 2000, closingBalance: 4000 },
});

const sale = {
  type: "Sale" as const,
  vchNo: "INV-1",
  date: "2026-11-10",
  particulars: "Order",
  narration: "Order",
  debit: 5000,
  credit: null,
  balance: 6000,
};

describe("LedgerBody", () => {
  it("renders the opening header, rows and the totals footer", () => {
    render(<LedgerBody data={data([sale])} refreshing={false} onRefresh={() => {}} />);
    expect(screen.getByText(/Opening · before/)).toBeInTheDocument();
    expect(screen.getByText("INV-1")).toBeInTheDocument(); // a transaction row
    expect(screen.getByText("Debit")).toBeInTheDocument();
    expect(screen.getByText("Closing")).toBeInTheDocument();
  });

  it("shows the empty state when there are no transactions", () => {
    render(<LedgerBody data={data([])} refreshing={false} onRefresh={() => {}} />);
    expect(screen.getByText("No transactions in this period.")).toBeInTheDocument();
  });
});
