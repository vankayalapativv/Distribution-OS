/**
 * Reimbursement payables (docs/FIELD-EXPENSE-ADVANCES-PLAN.md, Phase 2). An
 * approved claim creates a payable — money the company owes the employee. The
 * office settles it from a panel on the Expenditure page.
 */
export type PayableStatus = "owed" | "paid" | "reversed";

export interface ReimbursementPayable {
  id: string;
  userId: string | null;
  userName: string | null;
  amount: number;
  status: PayableStatus;
  categoryName: string;
  code: string;
  date: string;
  paymentMode: string | null;
  paidAt: string | null;
  createdAt: string;
}
