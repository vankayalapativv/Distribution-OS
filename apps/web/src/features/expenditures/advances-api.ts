/**
 * Salary advances (docs/FIELD-EXPENSE-ADVANCES-PLAN.md, Phase 3). The office
 * approves SE requests, records direct advances, and tracks what's outstanding.
 */
export type AdvanceStatus = "requested" | "active" | "rejected" | "cleared";

export interface Advance {
  id: string;
  userId: string | null;
  userName: string | null;
  amount: number;
  source: string;
  status: AdvanceStatus;
  recoveryPlan: string | null;
  installmentAmount: number | null;
  outstanding: number;
  reason: string | null;
  rejectReason: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface AdvanceBalance {
  userId: string | null;
  userName: string | null;
  outstanding: number;
}

export interface RecoveryPlanInput {
  recoveryPlan: "full_next" | "installment";
  installmentAmount: number | null;
}
