import type { SqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";

/**
 * Reimbursement payables (docs/FIELD-EXPENSE-ADVANCES-PLAN.md, Phase 2). An
 * approved claim creates a payable — money the company owes the employee. The
 * office settles it (mark paid); a person's balance = sum of their still-owed
 * payables. RLS auto-scopes by enterprise.
 */
type Row = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === "string" ? v : v instanceof Date ? v.toISOString() : "");
const strOrNull = (v: unknown): string | null => (str(v) ? str(v) : null);
const num = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);

const PAYABLE_COLUMNS = `
  p.id, p.user_id as "userId", u.name as "userName", p.amount, p.status,
  c.name as "categoryName", e.expenditure_code as "code", e.expenditure_date as "date",
  p.payment_mode as "paymentMode", p.paid_at as "paidAt", p.created_at as "createdAt"`;
const PAYABLE_FROM = `
  from reimbursement_payables p
  join expenditures e on e.id = p.expenditure_id
  join expenditure_categories c on c.id = e.category_id
  left join users u on u.id = p.user_id`;

function mapPayable(r: Row) {
  return {
    id: str(r.id), userId: strOrNull(r.userId), userName: strOrNull(r.userName),
    amount: num(r.amount), status: str(r.status),
    categoryName: str(r.categoryName), code: str(r.code), date: str(r.date),
    paymentMode: strOrNull(r.paymentMode), paidAt: strOrNull(r.paidAt), createdAt: str(r.createdAt),
  };
}

/** Office: the settle queue — payables by status (default still-owed). */
export async function listPayables(sql: SqlClient, status: string) {
  const s = status.trim() || "owed";
  const rows = (await sql.query(
    `/* list_payables */ select ${PAYABLE_COLUMNS} ${PAYABLE_FROM} where p.status = $1 order by p.created_at desc limit 200`,
    [s],
  )) as Row[];
  return rows.map(mapPayable);
}

/** Office: each person the company currently owes, most-owed first. */
export async function perPersonBalances(sql: SqlClient) {
  const rows = (await sql`
    /* reimbursement_balances */
    select p.user_id as "userId", u.name as "userName",
      coalesce(sum(p.amount) filter (where p.status = 'owed'), 0) as "owed",
      count(*) filter (where p.status = 'owed')::int as "owedCount"
    from reimbursement_payables p
    left join users u on u.id = p.user_id
    group by p.user_id, u.name
    having coalesce(sum(p.amount) filter (where p.status = 'owed'), 0) > 0
    order by "owed" desc
  `) as Row[];
  return rows.map((r) => ({ userId: strOrNull(r.userId), userName: strOrNull(r.userName), owed: num(r.owed), owedCount: num(r.owedCount) }));
}

/** Mobile: a field user's own reimbursements + the total still owed to them. */
export async function myReimbursements(sql: SqlClient, userId: string) {
  const rows = (await sql.query(
    `/* my_reimbursements */ select ${PAYABLE_COLUMNS} ${PAYABLE_FROM} where p.user_id = $1::uuid order by p.created_at desc limit 100`,
    [userId],
  )) as Row[];
  const payables = rows.map(mapPayable);
  const owedTotal = payables.filter((p) => p.status === "owed").reduce((acc, p) => acc + p.amount, 0);
  return { owedTotal, payables };
}

async function getPayable(sql: SqlClient, id: string) {
  const [row] = (await sql.query(
    `/* get_payable */ select ${PAYABLE_COLUMNS} ${PAYABLE_FROM} where p.id = $1::uuid limit 1`,
    [id],
  )) as Row[];
  if (!row) throw new ApiError("NOT_FOUND", "Payable not found.", 404);
  return mapPayable(row);
}

/** Office: settle a payable — cash/UPI/bank actually handed over. */
export async function markPaid(sql: SqlClient, payerId: string, id: string, paymentMode: string | null) {
  const payable = await getPayable(sql, id);
  if (payable.status !== "owed") throw new ApiError("CONFLICT", "Only an owed reimbursement can be marked paid.", 409);
  await sql`
    /* mark_payable_paid */
    update reimbursement_payables set
      status = 'paid', payment_mode = ${paymentMode}, paid_at = now(),
      paid_by = ${payerId}::uuid, updated_at = now()
    where id = ${id}::uuid and status = 'owed'
  `;
  return getPayable(sql, id);
}
