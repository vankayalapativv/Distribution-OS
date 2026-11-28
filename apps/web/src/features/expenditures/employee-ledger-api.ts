/**
 * Per-employee expense ledger (GET /expenditures/ledger?userId=). One combined
 * statement for a person — claims, advances, recoveries and (if the caller can
 * view salary) salary — as a time-ordered feed with a running "owed" balance.
 */
export interface LedgerEntry {
  at: string;
  kind: "claim_approved" | "reimbursed" | "claim_reversed" | "advance" | "recovered" | "salary";
  label: string;
  amount: number;
  owedDelta: number;
  balance: number;
}

export interface EmployeeLedger {
  summary: {
    reimbursementOwed: number;
    advanceOutstanding: number;
    monthlySalary: number | null;
    thisMonthNet: number | null;
  };
  salaryIncluded: boolean;
  entries: LedgerEntry[];
}
