/**
 * Field expense CLAIMS (docs/FIELD-EXPENSE-ADVANCES-PLAN.md, Phase 1). A claim is
 * an `expenditures` row awaiting review; approving it books it into the ledger.
 * The office reviews pending claims in a panel on the Expenditure page.
 */
export type ClaimStatus = "submitted" | "approved" | "rejected";

export interface ExpenseClaim {
  id: string;
  code: string;
  date: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  claimedAmount: number;
  status: ClaimStatus;
  remarks: string | null;
  rejectReason: string | null;
  hasReceipt: boolean;
  submittedBy: string | null;
  submitterName: string | null;
  approvedAt: string | null;
  createdAt: string;
}
