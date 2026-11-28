import type { SqlClient } from "../lib/db";

/**
 * Per-employee expense ledger (Field Expense feature). One combined statement for
 * a person: their reimbursement claims, advances, recoveries and (optionally)
 * salary payments, merged into a single time-ordered activity feed with a running
 * "company owes employee" balance.
 *
 * Balance convention (from the employee's side): an approved claim raises what the
 * company owes them (+); reimbursing it settles (−). An advance they take is money
 * they owe back, so it lowers the balance (−); recovering it from salary raises it
 * back (+). Salary payments are compensation, not part of this balance — they show
 * as info rows (amount only) and don't move it. RLS scopes every query by enterprise.
 */
type Row = Record<string, unknown>;
const num = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);
const str = (v: unknown): string => (typeof v === "string" ? v : v instanceof Date ? v.toISOString() : "");
const round2 = (n: number): number => Math.round(n * 100) / 100;

export interface LedgerEntry {
  at: string;
  kind: "claim_approved" | "reimbursed" | "claim_reversed" | "advance" | "recovered" | "salary";
  label: string;
  amount: number;
  /** How this event moves the company-owes-employee balance (0 for salary rows). */
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

/** Build the combined ledger for one person. `includeSalary` gates the sensitive
 *  salary figures (the caller passes whether they hold salary.view). */
export async function employeeLedger(sql: SqlClient, userId: string, includeSalary: boolean): Promise<EmployeeLedger> {
  const payables = (await sql.query(
    `/* ledger_payables */
     select p.amount, p.status, p.created_at, p.paid_at, p.reversed_at, p.payment_mode, c.name as category
     from reimbursement_payables p
     join expenditures e on e.id = p.expenditure_id
     join expenditure_categories c on c.id = e.category_id
     where p.user_id = $1::uuid`,
    [userId],
  )) as Row[];

  const advances = (await sql.query(
    `/* ledger_advances */
     select amount, status, coalesce(approved_at, created_at) as at
     from advances where user_id = $1::uuid and status in ('active', 'cleared')`,
    [userId],
  )) as Row[];

  const recoveries = (await sql.query(
    `/* ledger_recoveries */
     select r.amount, p.paid_at as at
     from salary_payment_recoveries r
     join salary_payments p on p.id = r.salary_payment_id
     where p.user_id = $1::uuid and p.reversed_at is null`,
    [userId],
  )) as Row[];

  const raw: Omit<LedgerEntry, "balance">[] = [];
  for (const p of payables) {
    const amount = num(p.amount);
    raw.push({ at: str(p.created_at), kind: "claim_approved", label: `Claim approved · ${str(p.category)}`, amount, owedDelta: amount });
    if (str(p.status) === "paid") raw.push({ at: str(p.paid_at), kind: "reimbursed", label: `Reimbursed${p.payment_mode ? ` · ${str(p.payment_mode)}` : ""}`, amount, owedDelta: -amount });
    if (str(p.status) === "reversed") raw.push({ at: str(p.reversed_at), kind: "claim_reversed", label: "Claim reversed", amount, owedDelta: -amount });
  }
  for (const a of advances) {
    const amount = num(a.amount);
    raw.push({ at: str(a.at), kind: "advance", label: "Advance taken", amount, owedDelta: -amount });
  }
  for (const r of recoveries) {
    const amount = num(r.amount);
    raw.push({ at: str(r.at), kind: "recovered", label: "Recovered from salary", amount, owedDelta: amount });
  }
  if (includeSalary) {
    const payments = (await sql.query(
      `/* ledger_salary */ select net_paid, paid_at from salary_payments where user_id = $1::uuid and reversed_at is null`,
      [userId],
    )) as Row[];
    for (const s of payments) raw.push({ at: str(s.paid_at), kind: "salary", label: "Salary paid", amount: num(s.net_paid), owedDelta: 0 });
  }

  raw.sort((x, y) => (x.at < y.at ? -1 : x.at > y.at ? 1 : 0));
  let balance = 0;
  const entries: LedgerEntry[] = raw.map((e) => {
    balance = round2(balance + e.owedDelta);
    return { ...e, balance };
  });

  const [owed] = (await sql.query(
    `/* ledger_owed */ select coalesce(sum(amount), 0) as v from reimbursement_payables where user_id = $1::uuid and status = 'owed'`,
    [userId],
  )) as Row[];
  const [outstanding] = (await sql.query(
    `/* ledger_outstanding */ select coalesce(sum(outstanding), 0) as v from advances where user_id = $1::uuid and status = 'active'`,
    [userId],
  )) as Row[];

  let monthlySalary: number | null = null;
  let thisMonthNet: number | null = null;
  if (includeSalary) {
    const [sal] = (await sql.query(
      `/* ledger_current_salary */ select monthly_amount from staff_salaries where user_id = $1::uuid and effective_from <= current_date order by effective_from desc limit 1`,
      [userId],
    )) as Row[];
    monthlySalary = sal ? num(sal.monthly_amount) : null;
    const [paid] = (await sql.query(
      `/* ledger_this_month */ select net_paid from salary_payments where user_id = $1::uuid and period_month = date_trunc('month', current_date)::date and reversed_at is null limit 1`,
      [userId],
    )) as Row[];
    thisMonthNet = paid ? num(paid.net_paid) : null;
  }

  return {
    summary: { reimbursementOwed: num(owed?.v), advanceOutstanding: num(outstanding?.v), monthlySalary, thisMonthNet },
    salaryIncluded: includeSalary,
    entries,
  };
}
