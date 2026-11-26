import type { LocalDb } from "../local-db";

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
