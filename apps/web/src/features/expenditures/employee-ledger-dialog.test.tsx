import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EmployeeLedger } from "./employee-ledger-api";

vi.mock("./use-expenditure-lookups", () => ({ useExpenditureLookups: () => ({ people: [{ id: "u1", name: "Priya" }] }) }));
const state = { ledger: null as EmployeeLedger | null, isLoading: false };
vi.mock("./use-employee-ledger", () => ({ useEmployeeLedger: () => state }));

import { EmployeeLedgerDialogBody } from "./employee-ledger-dialog";

const config = { apiBaseUrl: "", authToken: "" };
const ledger = (over: Partial<EmployeeLedger> = {}): EmployeeLedger => ({
  summary: { reimbursementOwed: 400, advanceOutstanding: 5000, monthlySalary: 25000, thisMonthNet: 20000 },
  salaryIncluded: true,
  entries: [
    { at: "2026-11-01T00:00:00Z", kind: "claim_approved", label: "Claim approved · Fuel", amount: 400, owedDelta: 400, balance: 400 },
    { at: "2026-11-03T00:00:00Z", kind: "advance", label: "Advance taken", amount: 5000, owedDelta: -5000, balance: -4600 },
    { at: "2026-11-06T00:00:00Z", kind: "salary", label: "Salary paid", amount: 20000, owedDelta: 0, balance: -4600 },
  ],
  ...over,
});
const pick = () => fireEvent.change(screen.getByLabelText("Person"), { target: { value: "u1" } });
beforeEach(() => { vi.clearAllMocks(); state.ledger = ledger(); state.isLoading = false; });
afterEach(() => vi.clearAllMocks());

describe("EmployeeLedgerDialogBody", () => {
  it("prompts to pick a person before anything is selected", () => {
    render(<EmployeeLedgerDialogBody actionConfig={config} />);
    expect(screen.getByText("Pick a person to see their statement.")).toBeInTheDocument();
  });

  it("shimmers while the picked person's ledger loads", () => {
    state.ledger = null; state.isLoading = true;
    render(<EmployeeLedgerDialogBody actionConfig={config} />);
    pick();
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
  });

  it("shows summary chips and the running-balance entries with tones", () => {
    render(<EmployeeLedgerDialogBody actionConfig={config} />);
    pick();
    expect(screen.getByText("Monthly salary")).toBeInTheDocument();
    expect(screen.getByText("This month net")).toBeInTheDocument();
    expect(screen.getByText("Claim approved · Fuel")).toBeInTheDocument();
    expect(screen.getByText("Salary paid")).toBeInTheDocument(); // zero-delta row renders unsigned
    expect(screen.getByText("+₹400")).toBeInTheDocument();
    expect(screen.getByText("−₹5,000")).toBeInTheDocument();
  });

  it("omits salary chips when not permitted, and shows an empty note with no activity", () => {
    state.ledger = ledger({ salaryIncluded: false, entries: [], summary: { reimbursementOwed: 0, advanceOutstanding: 0, monthlySalary: null, thisMonthNet: null } });
    render(<EmployeeLedgerDialogBody actionConfig={config} />);
    pick();
    expect(screen.queryByText("Monthly salary")).not.toBeInTheDocument();
    expect(screen.getByText("No expense activity yet.")).toBeInTheDocument();
  });

  it("falls back to a dash for a missing salary figure", () => {
    state.ledger = ledger({ summary: { reimbursementOwed: 0, advanceOutstanding: 0, monthlySalary: null, thisMonthNet: null } });
    render(<EmployeeLedgerDialogBody actionConfig={config} />);
    pick();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });
});
