import type { SqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";

/**
 * Payroll-lite salary (docs/FIELD-EXPENSE-ADVANCES-PLAN.md, Phase 4). A monthly
 * salary per person (effective-dated) + a monthly "pay salary" that nets advance
 * recovery: net = gross − recovery. Paying books the GROSS to the Salaries
 * expenditure category and reduces the person's outstanding advances (an advance
 * bigger than a month's pay recovers what fits and carries the rest). RLS scopes
 * by enterprise.
 */
type Row = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === "string" ? v : v instanceof Date ? v.toISOString() : "");
const strOrNull = (v: unknown): string | null => (str(v) ? str(v) : null);
const num = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);
const numOrNull = (v: unknown): number | null => (v == null ? null : num(v));
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** The person's current monthly salary (latest effective row), or null. */
export async function currentSalary(sql: SqlClient, userId: string): Promise<number | null> {
  const [row] = (await sql`
    /* current_salary */
    select monthly_amount from staff_salaries
    where user_id = ${userId}::uuid and effective_from <= current_date
    order by effective_from desc limit 1
  `) as Row[];
  return row ? num(row.monthly_amount) : null;
}

/** Set / change a person's salary (effective-dated; a raise is a new row). */
export async function setSalary(sql: SqlClient, officeId: string, userId: string, amount: number, effectiveFrom: string | null) {
  if (!(amount > 0)) throw new ApiError("VALIDATION", "Enter a salary greater than 0.", 422);
  await sql`
    /* set_salary */
    insert into staff_salaries (user_id, monthly_amount, effective_from, created_by)
    values (${userId}::uuid, ${amount}, coalesce(${effectiveFrom}::date, current_date), ${officeId}::uuid)
    on conflict (user_id, effective_from)
    do update set monthly_amount = excluded.monthly_amount, created_by = excluded.created_by
  `;
  return { userId, monthlyAmount: amount };
}

/** All active staff (for the salary person picker — salary covers everyone). */
export async function listStaff(sql: SqlClient) {
  const rows = (await sql`
    /* list_staff */
    select u.id, u.name, r.code as role
    from users u
    left join user_roles ur on ur.user_id = u.id
    left join roles r on r.id = ur.role_id
    where coalesce(u.status, 'active') = 'active'
    order by u.name
  `) as Row[];
  return rows.map((r) => ({ id: str(r.id), name: str(r.name), role: strOrNull(r.role) }));
}

/** Office salary table: each person with a salary or an active advance — current
 *  salary, outstanding advance, and whether they've been paid this month. */
export async function listSalaries(sql: SqlClient) {
  const rows = (await sql`
    /* list_salaries */
    select u.id as "userId", u.name as "userName",
      (select monthly_amount from staff_salaries s where s.user_id = u.id and s.effective_from <= current_date order by s.effective_from desc limit 1) as "salary",
      coalesce((select sum(outstanding) from advances a where a.user_id = u.id and a.status = 'active'), 0) as "advanceOutstanding",
      exists(select 1 from salary_payments p where p.user_id = u.id and p.period_month = date_trunc('month', current_date)::date) as "paidThisMonth"
    from users u
    where coalesce(u.status, 'active') = 'active'
      and (exists(select 1 from staff_salaries s where s.user_id = u.id)
        or exists(select 1 from advances a where a.user_id = u.id and a.status = 'active'))
    order by u.name
  `) as Row[];
  return rows.map((r) => ({
    userId: str(r.userId), userName: strOrNull(r.userName),
    salary: numOrNull(r.salary), advanceOutstanding: num(r.advanceOutstanding),
    paidThisMonth: r.paidThisMonth === true,
  }));
}

/** Compute how much of each active advance is recovered from `gross` this month
 *  (oldest first; installment plans recover their monthly amount, full-next the
 *  whole balance; capped at the salary — the rest carries forward). */
function planRecovery(advances: Row[], gross: number) {
  let remaining = gross;
  const updates: { id: string; newOutstanding: number }[] = [];
  for (const a of advances) {
    if (remaining <= 0) break; // salary exhausted — the rest carries to next month
    const outstanding = num(a.outstanding);
    const due = str(a.recovery_plan) === "installment" ? Math.min(num(a.installment_amount) || outstanding, outstanding) : outstanding;
    const recover = Math.min(due, remaining); // > 0: remaining > 0 and outstanding > 0 (filtered)
    updates.push({ id: str(a.id), newOutstanding: round2(outstanding - recover) });
    remaining = round2(remaining - recover);
  }
  return { recovered: round2(gross - remaining), updates };
}

/** Pay one person's salary for a month: nets advance recovery, books the gross to
 *  the Salaries category, reduces their advances. One per person per month. */
export async function paySalary(sql: SqlClient, officeId: string, userId: string, periodMonth: string, paymentMode: string | null) {
  const gross = await currentSalary(sql, userId);
  if (gross == null) throw new ApiError("VALIDATION", "Set this person's salary first.", 422);

  const [dupe] = (await sql`
    /* salary_payment_dupe */ select 1 from salary_payments where user_id = ${userId}::uuid and period_month = date_trunc('month', ${periodMonth}::date)::date limit 1
  `) as Row[];
  if (dupe) throw new ApiError("CONFLICT", "Salary for this month is already paid.", 409);

  const [cat] = (await sql`
    /* salary_category */ select id from expenditure_categories where name = 'Salaries' and is_active limit 1
  `) as Row[];
  if (!cat) throw new ApiError("NOT_FOUND", "The Salaries category is missing.", 404);

  const advances = (await sql.query(
    `/* active_advances_for_recovery */ select id, outstanding, recovery_plan, installment_amount from advances where user_id = $1::uuid and status = 'active' and outstanding > 0 order by created_at asc`,
    [userId],
  )) as Row[];
  const { recovered, updates } = planRecovery(advances, gross);
  const net = round2(gross - recovered);

  const [codeRow] = (await sql`
    /* next_salary_exp_code */ select coalesce(max(substring(expenditure_code from 5)::int), 0) + 1 as seq from expenditures where expenditure_code ~ '^EXP-[0-9]+$'
  `) as Row[];
  const code = `EXP-${String(num(codeRow?.seq) || 1).padStart(4, "0")}`;

  await sql.transaction([
    sql`
      /* record_salary_payment */
      insert into salary_payments (user_id, period_month, gross_amount, advance_recovered, net_paid, payment_mode, paid_by)
      values (${userId}::uuid, date_trunc('month', ${periodMonth}::date)::date, ${gross}, ${recovered}, ${net}, ${paymentMode}, ${officeId}::uuid)
    `,
    sql`
      /* book_salary_expenditure */
      insert into expenditures (expenditure_code, expenditure_date, category_id, amount, status, source, user_id, created_by, remarks)
      values (${code}, date_trunc('month', ${periodMonth}::date)::date, ${str(cat.id)}::uuid, ${gross}, 'approved', 'office', ${userId}::uuid, ${officeId}::uuid, 'Monthly salary')
    `,
    ...updates.map((u) => sql`
      /* recover_advance */ update advances set outstanding = ${u.newOutstanding}, status = ${u.newOutstanding <= 0 ? "cleared" : "active"}, updated_at = now() where id = ${u.id}::uuid
    `),
  ]);

  return { userId, gross, advanceRecovered: recovered, net };
}

/** Mobile: a person's own salary, advance outstanding, and this month's pay. */
export async function mySalary(sql: SqlClient, userId: string) {
  const salary = await currentSalary(sql, userId);
  const [adv] = (await sql`
    /* my_advance_outstanding */ select coalesce(sum(outstanding), 0) as "outstanding" from advances where user_id = ${userId}::uuid and status = 'active'
  `) as Row[];
  const [paid] = (await sql`
    /* my_salary_this_month */
    select gross_amount as "gross", advance_recovered as "recovered", net_paid as "net"
    from salary_payments where user_id = ${userId}::uuid and period_month = date_trunc('month', current_date)::date limit 1
  `) as Row[];
  return {
    monthlySalary: salary,
    advanceOutstanding: num(adv?.outstanding),
    thisMonth: paid ? { paid: true, gross: num(paid.gross), recovered: num(paid.recovered), net: num(paid.net) } : null,
  };
}
