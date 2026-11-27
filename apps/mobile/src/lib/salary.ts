import { apiFetch } from "./api";

/**
 * Payroll-lite "my pay" (Phase 4) — the SE/Logistics view of their own salary,
 * this month's net pay, and advance outstanding. Online-only. Each person only
 * ever sees their OWN figures (the server scopes it).
 */
export interface MyPay {
  monthlySalary: number | null;
  advanceOutstanding: number;
  thisMonth: { paid: boolean; gross: number; recovered: number; net: number } | null;
}

export function fetchMySalary(token: string | null): Promise<MyPay> {
  return apiFetch<MyPay>("/salary/mine", { token });
}
