import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicStatementView } from "./public-statement-view";
import type { PublicStatement } from "./statement-types";

const base: PublicStatement = {
  company: {
    legalName: "Distribution OS",
    gstin: "36ABCDE1234F1Z5",
    addressLine1: "12-3-45, MG Road",
    addressLine2: "",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500001",
  },
  customer: { name: "Sri Venkateswara Auto Spares", city: "Secunderabad" },
  asOf: "2026-10-05T06:00:00.000Z",
  totalOutstanding: 8500,
  paymentsUnderVerification: 5000,
  ageing: { "0_30": 8500, "30_45": 0, "45_60": 0, "60_plus": 0 },
  ledger: {
    from: "2026-04-05",
    to: "2026-10-05",
    openingBalance: 0,
    rows: [
      { date: "2026-09-21", type: "Sale", vchNo: "INV-CUST001", narration: "Sales", debit: 8500, credit: null, balance: 8500, paidOff: false, partiallyPaid: false },
      { date: "2026-10-03", type: "Rcpt", vchNo: null, narration: "Cash", debit: null, credit: 5000, balance: 3500 },
    ],
    totals: { debit: 8500, credit: 5000, closingBalance: 3500 },
  },
};

describe("PublicStatementView", () => {
  it("shows the reconciling block (billed − under-verification = net) when payments are pending", () => {
    render(<PublicStatementView data={base} />);
    expect(screen.getByText("Total outstanding (as billed)")).toBeInTheDocument();
    expect(screen.getByText("Less: payments under verification")).toBeInTheDocument();
    expect(screen.getByText("− ₹5,000")).toBeInTheDocument();
    expect(screen.getByText("Net balance")).toBeInTheDocument();
    // Net balance and the ledger closing balance both read ₹3,500 (Dr) and tie out.
    expect(screen.getAllByText("₹3,500 Dr").length).toBeGreaterThan(0);
    // Customer identity shown, no internal code.
    expect(screen.getAllByText("Sri Venkateswara Auto Spares").length).toBeGreaterThan(0);
    expect(screen.getByText("Secunderabad")).toBeInTheDocument();
    // A still-unpaid sale shows the paid-off status.
    expect(screen.getAllByText("Unpaid").length).toBeGreaterThan(0);
  });

  it("shows a plain total (no reconciling block) when nothing is pending", () => {
    render(
      <PublicStatementView
        data={{ ...base, paymentsUnderVerification: 0, totalOutstanding: 3500, ledger: { ...base.ledger, rows: [], totals: { debit: 0, credit: 0, closingBalance: 3500 } } }}
      />,
    );
    expect(screen.getByText("Total outstanding")).toBeInTheDocument();
    expect(screen.queryByText("Net balance")).not.toBeInTheDocument();
    expect(screen.queryByText("Less: payments under verification")).not.toBeInTheDocument();
  });
});
