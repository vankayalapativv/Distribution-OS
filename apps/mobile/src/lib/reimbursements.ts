import { apiFetch } from "./api";

/**
 * Reimbursements owed to the signed-in SE/Logistics user (Phase 2). An approved
 * claim becomes a payable the company owes them; this is the "owed to you" side.
 * Online-only, like the claims list.
 */
export type PayableStatus = "owed" | "paid" | "reversed";

export interface ReimbursementPayable {
  id: string;
  amount: number;
  status: PayableStatus;
  categoryName: string;
  code: string;
  date: string;
  paymentMode: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface MyReimbursements {
  owedTotal: number;
  payables: ReimbursementPayable[];
}

export function fetchMyReimbursements(token: string | null): Promise<MyReimbursements> {
  return apiFetch<MyReimbursements>("/reimbursements/mine", { token });
}
