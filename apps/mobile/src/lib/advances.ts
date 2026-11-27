import { apiFetch } from "./api";

/**
 * Salary advances (Phase 3) — the SE/Logistics side. A person can request an
 * advance (office approves) and see what's still outstanding (recovered from
 * their salary). Online-only.
 */
export type AdvanceStatus = "requested" | "active" | "rejected" | "cleared";

export interface Advance {
  id: string;
  amount: number;
  status: AdvanceStatus;
  recoveryPlan: string | null;
  installmentAmount: number | null;
  outstanding: number;
  reason: string | null;
  rejectReason: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface MyAdvances {
  outstandingTotal: number;
  advances: Advance[];
}

export function fetchMyAdvances(token: string | null): Promise<MyAdvances> {
  return apiFetch<MyAdvances>("/advances/mine", { token });
}

export function requestAdvanceApi(token: string | null, amount: number, reason: string | null): Promise<Advance> {
  return apiFetch<Advance>("/advances", { method: "POST", token, body: { amount, reason } });
}
