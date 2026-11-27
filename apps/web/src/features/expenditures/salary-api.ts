/**
 * Payroll-lite salary (docs/FIELD-EXPENSE-ADVANCES-PLAN.md, Phase 4). The office
 * sets a monthly salary per person and pays it each month — the pay nets this
 * month's advance recovery. Salary is sensitive (SA-only by default).
 */
export interface SalaryRow {
  userId: string;
  userName: string | null;
  salary: number | null;
  advanceOutstanding: number;
  paidThisMonth: boolean;
}

export interface Staff {
  id: string;
  name: string;
  role: string | null;
}
