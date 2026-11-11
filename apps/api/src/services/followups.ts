// Customer follow-ups (docs/PENDING-CUSTOMER-FOLLOWUPS.md). A resolvable
// commitment copied from a no-outcome visit: resurfaces to the SE at the next
// check-in, carries an optional follow-up date, and is marked done by the SE or
// the office. visits.no_outcome_reason stays the immutable per-visit record.
import type { SqlClient } from "../lib/db";

type Row = Record<string, unknown>;

export interface FollowupView {
  id: string;
  customerId: string;
  reason: string;
  /** ISO timestamp the SE picked, or null for context-only (no reminder). */
  followUpAt: string | null;
  status: string;
  createdAt: string;
}

function iso(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return null;
}

function mapFollowup(row: Row): FollowupView {
  return {
    id: String(row.id),
    customerId: String(row.customerId),
    reason: typeof row.reason === "string" ? row.reason : "",
    followUpAt: iso(row.followUpAt),
    status: typeof row.status === "string" ? row.status : "open",
    createdAt: iso(row.createdAt) ?? "",
  };
}

/**
 * Create a follow-up for a no-outcome checkout, superseding any prior OPEN one
 * for the customer so only the latest shows (≤1 open per customer). Called from
 * checkOut when a no-outcome reason was recorded.
 */
export async function createCheckoutFollowup(
  sql: SqlClient,
  input: {
    customerId: string;
    createdBy: string;
    visitId: string;
    reason: string;
    followUpAt: string | null;
  },
): Promise<void> {
  await sql`
    /* supersede_open_followups */
    update customer_followups
    set status = 'done', resolution = 'superseded', resolved_at = now()
    where customer_id = ${input.customerId}::uuid and status = 'open'
  `;
  await sql`
    /* insert_followup */
    insert into customer_followups (customer_id, created_by, visit_id, reason, follow_up_at)
    values (
      ${input.customerId}::uuid,
      ${input.createdBy}::uuid,
      ${input.visitId}::uuid,
      ${input.reason},
      ${input.followUpAt}
    )
  `;
}

/** The latest OPEN follow-up for a customer — shown at check-in / on the card. */
export async function getLatestOpenFollowup(
  sql: SqlClient,
  customerId: string,
): Promise<FollowupView | null> {
  const [row] = (await sql`
    /* latest_open_followup */
    select id, customer_id as "customerId", reason, follow_up_at as "followUpAt",
           status, created_at as "createdAt"
    from customer_followups
    where customer_id = ${customerId}::uuid and status = 'open'
    order by created_at desc
    limit 1
  `) as Row[];
  return row ? mapFollowup(row) : null;
}

export interface FollowupReminderPush {
  tokens: string[];
  title: string;
  body: string;
}

/**
 * Phase 2 push: fire a reminder for every OPEN follow-up whose picked date+time
 * has arrived and hasn't been notified yet. Marks each notified_at so a later
 * cron tick won't re-push, records an in-app se_notifications row, and returns
 * the Expo push targets (one per follow-up). Runs on every maintenance tick, so
 * a reminder fires within the cron granularity of its time (or at window-open
 * when the time fell outside business hours).
 */
export async function runFollowupReminders(
  sql: SqlClient,
  now: string = new Date().toISOString(),
): Promise<{ notified: number; pushes: FollowupReminderPush[] }> {
  const due = (await sql`
    /* due_followups */
    select f.id, f.created_by as "seId", f.customer_id as "customerId",
           f.reason, c.legal_name as "customerName"
    from customer_followups f
    join customers c on c.id = f.customer_id
    where f.status = 'open'
      and f.follow_up_at is not null
      and f.notified_at is null
      and f.follow_up_at <= ${now}::timestamptz
    order by f.follow_up_at
    limit 200
  `) as Row[];
  if (due.length === 0) return { notified: 0, pushes: [] };

  const ids = due.map((r) => String(r.id));
  await sql`
    /* mark_followups_notified */
    update customer_followups set notified_at = now() where id = any(${ids}::uuid[])
  `;

  const rows = due.map((r) => ({
    seId: String(r.seId),
    customerId: String(r.customerId),
    title: `Follow up: ${String(r.customerName)}`,
    body: `${String(r.customerName)} — "${String(r.reason)}". Visit to take the order or collection.`,
  }));
  await sql`
    /* followup_due_notifications */
    insert into se_notifications (user_id, type, title, body, customer_id)
    select (v->>'seId')::uuid, 'followup_due', v->>'title', v->>'body', (v->>'customerId')::uuid
    from jsonb_array_elements(${JSON.stringify(rows)}::jsonb) as v
  `;

  const seIds = Array.from(new Set(rows.map((r) => r.seId)));
  const tokenRows = (await sql`
    /* followup_push_tokens */
    select user_id as "userId", token from push_tokens where user_id = any(${seIds}::uuid[])
  `) as Row[];
  const tokensBySe = new Map<string, string[]>();
  for (const t of tokenRows) {
    const list = tokensBySe.get(String(t.userId)) ?? [];
    list.push(String(t.token));
    tokensBySe.set(String(t.userId), list);
  }
  const pushes = rows
    .map((r) => ({ tokens: tokensBySe.get(r.seId) ?? [], title: r.title, body: r.body }))
    .filter((p) => p.tokens.length > 0);

  return { notified: due.length, pushes };
}

/**
 * Mark the latest OPEN follow-up for a customer done. Resolve-by-customer (not by
 * id) so the offline mobile client — which never learns the server-assigned id —
 * can still resolve it. There is at most one open per customer, so it's
 * unambiguous. Returns the resolved row, or null if none was open.
 */
export async function resolveLatestOpenForCustomer(
  sql: SqlClient,
  input: { customerId: string; userId: string },
): Promise<FollowupView | null> {
  const [row] = (await sql`
    /* resolve_latest_open_followup */
    update customer_followups
    set status = 'done', resolution = 'manual',
        resolved_by = ${input.userId}::uuid, resolved_at = now()
    where id = (
      select id from customer_followups
      where customer_id = ${input.customerId}::uuid and status = 'open'
      order by created_at desc
      limit 1
    )
    returning id, customer_id as "customerId", reason, follow_up_at as "followUpAt",
              status, created_at as "createdAt"
  `) as Row[];
  return row ? mapFollowup(row) : null;
}
