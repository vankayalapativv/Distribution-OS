import type { SqlClient } from "../lib/db";
import { ApiError } from "../lib/errors";
import { VALID_EXPENDITURE_PAYMENT_MODES } from "./expenditures";

/**
 * Field expense CLAIMS — the submit + review lifecycle on top of `expenditures`
 * (docs/FIELD-EXPENSE-ADVANCES-PLAN.md, Phase 1). A claim is an `expenditures`
 * row with status 'submitted'; approving it books it (status 'approved') into the
 * same ledger, at the approved (possibly reduced) amount. RLS auto-scopes by
 * enterprise, so no manual enterprise filter here.
 */

type Row = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === "string" ? v : v instanceof Date ? v.toISOString() : "");
const strOrNull = (v: unknown): string | null => (str(v) ? str(v) : null);
const num = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);

const CLAIM_COLUMNS = `
  e.id, e.expenditure_code as "code", e.expenditure_date as "date",
  e.category_id as "categoryId", c.name as "categoryName",
  e.amount, e.claimed_amount as "claimedAmount",
  e.status, e.remarks, e.reject_reason as "rejectReason",
  e.bill_file_key as "billFileKey",
  e.submitted_by as "submittedBy", su.name as "submitterName",
  e.approved_at as "approvedAt", e.created_at as "createdAt"`;
const CLAIM_FROM = `
  from expenditures e
  join expenditure_categories c on c.id = e.category_id
  left join users su on su.id = e.submitted_by`;

function mapClaim(r: Row) {
  return {
    id: str(r.id), code: str(r.code), date: str(r.date),
    categoryId: str(r.categoryId), categoryName: str(r.categoryName),
    amount: num(r.amount), claimedAmount: num(r.claimedAmount),
    status: str(r.status), remarks: strOrNull(r.remarks), rejectReason: strOrNull(r.rejectReason),
    hasReceipt: Boolean(r.billFileKey),
    submittedBy: strOrNull(r.submittedBy), submitterName: strOrNull(r.submitterName),
    approvedAt: strOrNull(r.approvedAt), createdAt: str(r.createdAt),
  };
}

/** The field-claimable categories (active + variable) for the mobile picker. */
export async function listClaimCategories(sql: SqlClient) {
  const rows = (await sql`
    /* claim_categories */
    select id, name from expenditure_categories
    where is_active and type = 'variable' order by name
  `) as Row[];
  return rows.map((r) => ({ id: str(r.id), name: str(r.name) }));
}

export interface ClaimInput {
  categoryId: string;
  amount: number;
  expenditureDate: string;
  remarks?: string | null;
  clientUuid?: string | null;
}

/** A field claim MUST target an active, variable (field) category. */
async function assertFieldCategory(sql: SqlClient, categoryId: string): Promise<void> {
  const [cat] = (await sql`
    /* claim_category_check */
    select type from expenditure_categories where id = ${categoryId}::uuid and is_active limit 1
  `) as Row[];
  if (!cat) throw new ApiError("NOT_FOUND", "Category not found.", 404);
  if (str(cat.type) !== "variable") {
    throw new ApiError("VALIDATION", "That category can't be claimed from the field.", 422);
  }
}

/** Create a submitted claim (receipt is attached by the caller right after). */
export async function submitClaim(sql: SqlClient, submittedBy: string, input: ClaimInput) {
  if (!(input.amount > 0)) throw new ApiError("VALIDATION", "Enter an amount greater than 0.", 422);
  await assertFieldCategory(sql, input.categoryId);
  if (input.clientUuid) {
    const [dupe] = (await sql`
      /* claim_idempotency */ select id from expenditures where client_uuid = ${input.clientUuid}::uuid limit 1
    `) as Row[];
    if (dupe) return getClaim(sql, str(dupe.id));
  }
  const [codeRow] = (await sql`
    /* next_claim_code */
    select coalesce(max(substring(expenditure_code from 5)::int), 0) + 1 as seq
    from expenditures where expenditure_code ~ '^EXP-[0-9]+$'
  `) as Row[];
  const code = `EXP-${String(num(codeRow?.seq) || 1).padStart(4, "0")}`;
  const [row] = (await sql`
    /* submit_claim */
    insert into expenditures (
      expenditure_code, expenditure_date, category_id, amount, claimed_amount,
      status, source, submitted_by, user_id, remarks, created_by, client_uuid
    ) values (
      ${code}, ${input.expenditureDate}::date, ${input.categoryId}::uuid,
      ${input.amount}, ${input.amount},
      'submitted', 'field', ${submittedBy}::uuid, ${submittedBy}::uuid,
      ${input.remarks ?? null}, ${submittedBy}::uuid, ${input.clientUuid ?? null}::uuid
    ) returning id
  `) as Row[];
  return getClaim(sql, str(row.id));
}

export async function getClaim(sql: SqlClient, id: string) {
  const [row] = (await sql.query(
    `/* get_claim */ select ${CLAIM_COLUMNS} ${CLAIM_FROM} where e.id = $1::uuid limit 1`,
    [id],
  )) as Row[];
  if (!row) throw new ApiError("NOT_FOUND", "Claim not found.", 404);
  return mapClaim(row);
}

/** Queue (office, by status) or a field user's own claims (submittedBy). */
export async function listClaims(
  sql: SqlClient,
  opts: { status?: string | null; submittedBy?: string | null },
) {
  const conds: string[] = [];
  const params: unknown[] = [];
  const status = (opts.status ?? "").trim();
  if (status) { params.push(status); conds.push(`e.status = $${params.length}`); }
  else conds.push("e.source = 'field'"); // the whole claims stream, any status
  if (opts.submittedBy) { params.push(opts.submittedBy); conds.push(`e.submitted_by = $${params.length}::uuid`); }
  const rows = (await sql.query(
    `/* list_claims */ select ${CLAIM_COLUMNS} ${CLAIM_FROM}
     where ${conds.join(" and ")} order by e.created_at desc limit 200`,
    params,
  )) as Row[];
  return rows.map(mapClaim);
}

/** Approve a submitted claim, optionally at a reduced amount → it books as spend
 *  AND creates a reimbursement payable (company owes the submitter). One payable
 *  per claim; the book + payable are written in one transaction (Phase 2). */
/** Approve a claim and reimburse it in one step (decided 2026-11-28): the claim
 *  books into the ledger at the approved amount WITH the chosen payment mode, and
 *  its reimbursement payable is created already `paid` (paid_at = now). There is
 *  no separate "owed → settle" step anymore — approval is the reimbursement. */
export async function approveClaim(
  sql: SqlClient,
  approverId: string,
  id: string,
  approvedAmount: number | null,
  paymentMode: string | null,
) {
  const claim = await getClaim(sql, id);
  if (claim.status !== "submitted") throw new ApiError("CONFLICT", "Only a submitted claim can be approved.", 409);
  if (!claim.submittedBy) throw new ApiError("CONFLICT", "Claim has no submitter.", 409);
  if (approvedAmount != null && !(approvedAmount > 0 && approvedAmount <= claim.claimedAmount)) {
    throw new ApiError("VALIDATION", "Approved amount must be between 0 and the claimed amount.", 422);
  }
  if (!paymentMode || !(VALID_EXPENDITURE_PAYMENT_MODES as readonly string[]).includes(paymentMode)) {
    throw new ApiError("VALIDATION", "Pick how the claim was reimbursed.", 422);
  }
  const approved = approvedAmount ?? claim.claimedAmount;
  await sql.transaction([
    sql`
      /* approve_claim */
      update expenditures set
        status = 'approved', amount = ${approved}, payment_mode = ${paymentMode},
        approved_by = ${approverId}::uuid, approved_at = now(),
        reject_reason = null, updated_at = now()
      where id = ${id}::uuid and status = 'submitted'
    `,
    sql`
      /* reimburse_on_approval */
      insert into reimbursement_payables (expenditure_id, user_id, amount, status, payment_mode, paid_at, paid_by)
      values (${id}::uuid, ${claim.submittedBy}::uuid, ${approved}, 'paid', ${paymentMode}, now(), ${approverId}::uuid)
      on conflict (expenditure_id) do nothing
    `,
  ]);
  return getClaim(sql, id);
}

/** Reject a submitted claim with a reason; the SE can edit + resubmit. */
export async function rejectClaim(sql: SqlClient, approverId: string, id: string, reason: string) {
  if (!reason.trim()) throw new ApiError("VALIDATION", "Give a reason so the person can fix it.", 422);
  const claim = await getClaim(sql, id);
  if (claim.status !== "submitted") throw new ApiError("CONFLICT", "Only a submitted claim can be rejected.", 409);
  await sql`
    /* reject_claim */
    update expenditures set status = 'rejected', reject_reason = ${reason.trim()},
      approved_by = ${approverId}::uuid, updated_at = now()
    where id = ${id}::uuid and status = 'submitted'
  `;
  return getClaim(sql, id);
}

/** The owner edits a rejected claim and resubmits it for review. */
/** Edit a claim that isn't approved yet — a still-pending (submitted) one, or a
 *  rejected one being fixed + resubmitted (2026-11-28). Either way it ends up
 *  `submitted` awaiting approval; an approved claim can no longer be edited. */
export async function resubmitClaim(sql: SqlClient, submittedBy: string, id: string, input: ClaimInput) {
  if (!(input.amount > 0)) throw new ApiError("VALIDATION", "Enter an amount greater than 0.", 422);
  await assertFieldCategory(sql, input.categoryId);
  const claim = await getClaim(sql, id);
  if (claim.submittedBy !== submittedBy) throw new ApiError("NOT_FOUND", "Claim not found.", 404);
  if (claim.status !== "rejected" && claim.status !== "submitted") {
    throw new ApiError("CONFLICT", "Only a claim that hasn't been approved yet can be edited.", 409);
  }
  await sql`
    /* resubmit_claim */
    update expenditures set
      category_id = ${input.categoryId}::uuid, amount = ${input.amount}, claimed_amount = ${input.amount},
      expenditure_date = ${input.expenditureDate}::date, remarks = ${input.remarks ?? null},
      status = 'submitted', reject_reason = null, updated_at = now()
    where id = ${id}::uuid and submitted_by = ${submittedBy}::uuid and status in ('submitted', 'rejected')
  `;
  return getClaim(sql, id);
}
