import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LedgerTableFooter } from "./ledger-table-footer";
import type { LedgerData } from "./ledger-types";

const data = (closing: number): LedgerData => ({
  from: "2026-07-01",
  to: "2026-07-31",
  openingBalance: 100,
  rows: [],
  totals: { debit: 1000, credit: 400, closingBalance: closing },
});

const renderFooter = (d: LedgerData) => render(<table>{<LedgerTableFooter data={d} />}</table>);

describe("LedgerTableFooter", () => {
  it("shows totals and a Debit balance when the closing is positive", () => {
    renderFooter(data(700));
    expect(screen.getByText("1,000.00")).toBeInTheDocument();
    expect(screen.getByText("400.00")).toBeInTheDocument();
    expect(screen.getByText("Debit Balance")).toBeInTheDocument();
    expect(screen.getByText("700.00 Dr")).toBeInTheDocument();
  });

  it("shows a Credit balance when the closing is negative", () => {
    renderFooter(data(-700));
    expect(screen.getByText("Credit Balance")).toBeInTheDocument();
    expect(screen.getByText("700.00 Cr")).toBeInTheDocument();
  });
});
