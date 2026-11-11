/**
 * Customer follow-ups — the offline local store (pure, no React-Native imports so
 * it's unit-testable). See docs/PENDING-CUSTOMER-FOLLOWUPS.md. A no-outcome
 * checkout records a follow-up for the customer; it resurfaces at the next
 * check-in and can be marked done. One OPEN per customer (a newer one supersedes).
 */
import type { LocalDb } from "../local-db";

function uuid(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    // Non-security local id — only a fallback when crypto.randomUUID is absent.
    const r = Math.floor(Math.random() * 16);
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface LocalFollowup {
  reason: string;
  followUpAt: string | null;
  createdAt: number;
}

/** An open follow-up that carries a reminder time — shown in the Reminders tab. */
export interface FollowupReminder {
  customerId: string;
  customerName: string;
  reason: string;
  /** ISO timestamp the SE picked. */
  followUpAt: string;
}

/** Every OPEN follow-up that has a reminder time, soonest first, with the
 *  customer's name joined from the local cache. Feeds the Reminders tab. */
export function listFollowupReminders(db: LocalDb): FollowupReminder[] {
  return db
    .all<{ customer_id: string; name: string | null; reason: string; follow_up_at: string }>(
      // Name from the follow-up's own snapshot, else the cached customer, else a
      // neutral fallback — so it reads right even without the customers cache.
      `select f.customer_id,
              coalesce(f.customer_name, c.legal_name) as name,
              f.reason, f.follow_up_at
       from customer_followups f
       left join customers c on c.id = f.customer_id
       where f.status = 'open' and f.follow_up_at is not null
       order by f.follow_up_at asc`,
    )
    .map((r) => ({
      customerId: r.customer_id,
      customerName: r.name ?? "Customer",
      reason: r.reason,
      followUpAt: r.follow_up_at,
    }));
}

/** Count of OPEN follow-ups that carry a reminder time — the Reminders tab badge. */
export function pendingFollowupCount(db: LocalDb): number {
  return (
    db.first<{ n: number }>(
      `select count(*) as n from customer_followups
       where status = 'open' and follow_up_at is not null`,
    )?.n ?? 0
  );
}

/** Record a follow-up locally at a no-outcome checkout, superseding the prior
 *  OPEN one for the customer (≤1 open per customer). */
export function recordFollowup(
  db: LocalDb,
  input: { customerId: string; customerName?: string; reason: string; followUpAt: string | null },
  now: number,
): void {
  db.run("update customer_followups set status = 'done' where customer_id = ? and status = 'open'", [
    input.customerId,
  ]);
  db.run(
    `insert into customer_followups (client_uuid, customer_id, customer_name, reason, follow_up_at, status, created_at)
     values (?, ?, ?, ?, ?, 'open', ?)`,
    [uuid(), input.customerId, input.customerName ?? null, input.reason, input.followUpAt, now],
  );
}

/** The latest OPEN follow-up for a customer (null if none) — the check-in popup + card. */
export function getOpenFollowup(db: LocalDb, customerId: string): LocalFollowup | null {
  const row = db.first<{ reason: string; follow_up_at: string | null; created_at: number }>(
    `select reason, follow_up_at, created_at from customer_followups
     where customer_id = ? and status = 'open' order by created_at desc limit 1`,
    [customerId],
  );
  return row ? { reason: row.reason, followUpAt: row.follow_up_at, createdAt: row.created_at } : null;
}

/** Mark the customer's open follow-up done locally. Returns true if one was open. */
export function resolveFollowupLocal(db: LocalDb, customerId: string): boolean {
  if (!getOpenFollowup(db, customerId)) return false;
  db.run("update customer_followups set status = 'done' where customer_id = ? and status = 'open'", [
    customerId,
  ]);
  return true;
}
