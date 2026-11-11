import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./ledger-skeleton-rows", () => ({ LedgerSkeletonRows: () => <tr><td>skeleton</td></tr> }));
vi.mock("./ledger-table-row", () => ({
  LedgerTableRow: (p: { row: { vchNo: string } }) => <tr><td>row:{p.row.vchNo}</td></tr>,
}));
vi.mock("./ledger-table-footer", () => ({ LedgerTableFooter: () => <tfoot><tr><td>footer</td></tr></tfoot> }));

import { LedgerTable } from "./ledger-table";
import type { LedgerData } from "./ledger-types";

const data = (rows: number): LedgerData => ({
  from: "2026-07-01",
  to: "2026-07-31",
  openingBalance: 100,
  rows: Array.from({ length: rows }, (_, i) => ({ vchNo: `INV-${i}` }) as never),
  totals: { debit: 0, credit: 0, closingBalance: 0 },
});

const handlers = { onOpenInvoice: vi.fn(), onOpenProof: vi.fn(), onOpenReturnProof: vi.fn(), onEdit: vi.fn() };
const base = { canViewProof: true, canEditEntries: true, handlers };

describe("LedgerTable", () => {
  it("shows the skeleton while loading (no opening row or footer)", () => {
    render(<LedgerTable {...base} data={undefined} showSkeleton empty={false} />);
    expect(screen.getByText("skeleton")).toBeInTheDocument();
    expect(screen.queryByText(/Opening Balance/)).not.toBeInTheDocument();
    expect(screen.queryByText("footer")).not.toBeInTheDocument();
  });

  it("shows the empty state with the opening row and no footer", () => {
    render(<LedgerTable {...base} data={data(0)} showSkeleton={false} empty />);
    expect(screen.getByText(/Opening Balance/)).toBeInTheDocument();
    expect(screen.getByText("No transactions in this period.")).toBeInTheDocument();
    expect(screen.queryByText("footer")).not.toBeInTheDocument();
  });

  it("renders rows and the footer when there are transactions", () => {
    render(<LedgerTable {...base} data={data(2)} showSkeleton={false} empty={false} />);
    expect(screen.getByText("row:INV-0")).toBeInTheDocument();
    expect(screen.getByText("row:INV-1")).toBeInTheDocument();
    expect(screen.getByText("footer")).toBeInTheDocument();
  });
});
