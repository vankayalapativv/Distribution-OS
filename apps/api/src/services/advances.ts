import type { SqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";

/**
 * Salary advances (docs/FIELD-EXPENSE-ADVANCES-PLAN.md, Phase 3). Cash given
 * ahead of salary — a receivable, recovered from salary later (Phase 4). An SE
 * REQUESTS one (office approves) or the office RECORDS one directly. RLS scopes
 * by enterprise.
 */
type Row = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === "string" ? v : v instanceof Date ? v.toISOString() : "");
const strOrNull = (v: unknown): string | null => (str(v) ? str(v) : null);
const num = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);
const numOrNull = (v: unknown): number | null => (v == null ? null : num(v));

const ADVANCE_COLUMNS = `
  a.id, a.user_id as "userId", u.name as "userName", a.amount, a.source, a.status,
  a.recovery_plan as "recoveryPlan", a.installment_amount as "installmentAmount",
  a.outstanding, a.reason, a.reject_reason as "rejectReason",
  a.approved_at as "approvedAt", a.created_at as "createdAt"`;
const ADVANCE_FROM = `from advances a left join users u on u.id = a.user_id`;

function mapAdvance(r: Row) {
  return {
    id: str(r.id), userId: strOrNull(r.userId), userName: strOrNull(r.userName),
    amount: num(r.amount), source: str(r.source), status: str(r.status),
    recoveryPlan: strOrNull(r.recoveryPlan), installmentAmount: numOrNull(r.installmentAmount),
    outstanding: num(r.outstanding), reason: strOrNull(r.reason), rejectReason: strOrNull(r.rejectReason),
    approvedAt: strOrNull(r.approvedAt), createdAt: str(r.createdAt),
  };
}

export interface RecoveryPlan {
  recoveryPlan: string;
  installmentAmount?: number | null;
}

/** A recovery plan must be full_next, or installment with a sane ₹/month. */
function assertPlan(plan: RecoveryPlan, amount: number): void {
  if (plan.recoveryPlan !== "full_next" && plan.recoveryPlan !== "installment") {
    throw new ApiError("VALIDATION", "Pick a recovery plan.", 422);
  }
  if (plan.recoveryPlan === "installment" && !(plan.installmentAmount != null && plan.installmentAmount > 0 && plan.installmentAmount <= amount)) {
    throw new ApiError("VALIDATION", "Installment must be between 0 and the advance amount.", 422);
  }
}

export async function getAdvance(sql: SqlClient, id: string) {
  const [row] = (await sql.query(
    `/* get_advance */ select ${ADVANCE_COLUMNS} ${ADVANCE_FROM} where a.id = $1::uuid limit 1`,
    [id],
  )) as Row[];
  if (!row) throw new ApiError("NOT_FOUND", "Advance not found.", 404);
  return mapAdvance(row);
}

/** SE/Logistics request an advance (awaits office approval; nothing disbursed yet). */
export async function requestAdvance(sql: SqlClient, userId: string, amount: number, reason: string | null) {
  if (!(amount > 0)) throw new ApiError("VALIDATION", "Enter an amount greater than 0.", 422);
  const [row] = (await sql`
    /* request_advance */
    insert into advances (user_id, amount, source, status, reason, requested_by)
    values (${userId}::uuid, ${amount}, 'request', 'requested', ${reason}, ${userId}::uuid)
    returning id
  `) as Row[];
  return getAdvance(sql, str(row.id));
}

/** Office records a direct advance (already handed over → active immediately). */
export async function recordAdvance(
  sql: SqlClient,
  officeId: string,
  input: { userId: string; amount: number; reason: string | null } & RecoveryPlan,
) {
  if (!(input.amount > 0)) throw new ApiError("VALIDATION", "Enter an amount greater than 0.", 422);
  assertPlan(input, input.amount);
  const [row] = (await sql`
    /* record_advance */
    insert into advances (user_id, amount, source, status, recovery_plan, installment_amount, outstanding, reason, requested_by, approved_by, approved_at)
    values (${input.userId}::uuid, ${input.amount}, 'direct', 'active', ${input.recoveryPlan}, ${input.installmentAmount ?? null}, ${input.amount}, ${input.reason}, ${officeId}::uuid, ${officeId}::uuid, now())
    returning id
  `) as Row[];
  return getAdvance(sql, str(row.id));
}

/** Office approves a requested advance → active, with a recovery plan. */
export async function approveAdvance(sql: SqlClient, officeId: string, id: string, plan: RecoveryPlan) {
  const advance = await getAdvance(sql, id);
  if (advance.status !== "requested") throw new ApiError("CONFLICT", "Only a requested advance can be approved.", 409);
  assertPlan(plan, advance.amount);
  await sql`
    /* approve_advance */
    update advances set status = 'active', outstanding = amount,
      recovery_plan = ${plan.recoveryPlan}, installment_amount = ${plan.installmentAmount ?? null},
      approved_by = ${officeId}::uuid, approved_at = now(), reject_reason = null, updated_at = now()
    where id = ${id}::uuid and status = 'requested'
  `;
  return getAdvance(sql, id);
}

/** Office rejects a requested advance with a reason. */
export async function rejectAdvance(sql: SqlClient, officeId: string, id: string, reason: string) {
  if (!reason.trim()) throw new ApiError("VALIDATION", "Give a reason.", 422);
  const advance = await getAdvance(sql, id);
  if (advance.status !== "requested") throw new ApiError("CONFLICT", "Only a requested advance can be rejected.", 409);
  await sql`
    /* reject_advance */
    update advances set status = 'rejected', reject_reason = ${reason.trim()}, approved_by = ${officeId}::uuid, updated_at = now()
    where id = ${id}::uuid and status = 'requested'
  `;
  return getAdvance(sql, id);
}

/** Office: advances by status (default = pending requests). */
export async function listAdvances(sql: SqlClient, status: string) {
  const s = status.trim() || "requested";
  const rows = (await sql.query(
    `/* list_advances */ select ${ADVANCE_COLUMNS} ${ADVANCE_FROM} where a.status = $1 order by a.created_at desc limit 200`,
    [s],
  )) as Row[];
  return rows.map(mapAdvance);
}

/** Office: each person with an outstanding advance, most-owed first. */
export async function perPersonAdvanceBalances(sql: SqlClient) {
  const rows = (await sql`
    /* advance_balances */
    select a.user_id as "userId", u.name as "userName",
      coalesce(sum(a.outstanding) filter (where a.status = 'active'), 0) as "outstanding"
    from advances a left join users u on u.id = a.user_id
    group by a.user_id, u.name
    having coalesce(sum(a.outstanding) filter (where a.status = 'active'), 0) > 0
    order by "outstanding" desc
  `) as Row[];
  return rows.map((r) => ({ userId: strOrNull(r.userId), userName: strOrNull(r.userName), outstanding: num(r.outstanding) }));
}

/** Mobile: a user's own advances + their total outstanding. */
export async function myAdvances(sql: SqlClient, userId: string) {
  const rows = (await sql.query(
    `/* my_advances */ select ${ADVANCE_COLUMNS} ${ADVANCE_FROM} where a.user_id = $1::uuid order by a.created_at desc limit 100`,
    [userId],
  )) as Row[];
  const advances = rows.map(mapAdvance);
  const outstandingTotal = advances.filter((a) => a.status === "active").reduce((acc, a) => acc + a.outstanding, 0);
  return { outstandingTotal, advances };
}
