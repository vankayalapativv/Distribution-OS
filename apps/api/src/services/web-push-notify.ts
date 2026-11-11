import type { SqlClient } from "../lib/db";
import { sendWebPush, type PushSubscription, type VapidKeys } from "../lib/web-push";
import type { ApiEnv } from "../types";

type Row = Record<string, unknown>;
const str = (v: unknown): string => {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
};

/** VAPID keys from the Worker env, or null when Web Push isn't configured. */
export function vapidFromEnv(env: ApiEnv["Bindings"]): VapidKeys | null {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) return null;
  return {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT,
  };
}

/** ₹ with Indian grouping (whole rupees), for notification bodies. */
export function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export async function saveWebPushSubscription(
  sql: SqlClient,
  userId: string,
  sub: PushSubscription,
): Promise<void> {
  await sql`
    /* upsert_web_push_subscription */
    insert into web_push_subscriptions (user_id, endpoint, p256dh, auth)
    values (${userId}::uuid, ${sub.endpoint}, ${sub.p256dh}, ${sub.auth})
    on conflict (endpoint)
      do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth
  `;
}

export async function deleteWebPushSubscription(
  sql: SqlClient,
  userId: string,
  endpoint: string,
): Promise<void> {
  // Scope to the owner so one user can't remove another user's subscription by
  // knowing its endpoint (the subscribe path already binds to auth.userId).
  await sql`
    /* delete_web_push_subscription */
    delete from web_push_subscriptions
    where endpoint = ${endpoint} and user_id = ${userId}::uuid
  `;
}

/**
 * System prune of a dead endpoint (push service returned 404/410 Gone). Not a
 * user action — the subscription no longer exists at the push service, so it is
 * removed regardless of owner. NEVER call this from a user-facing route.
 */
export async function pruneDeadWebPushSubscription(sql: SqlClient, endpoint: string): Promise<void> {
  await sql`
    /* prune_dead_web_push_subscription */
    delete from web_push_subscriptions where endpoint = ${endpoint}
  `;
}

/** Customer display name for the notification body (null if not found). */
export async function customerName(sql: SqlClient, customerId: string | null | undefined): Promise<string | null> {
  if (!customerId) return null;
  const [row] = (await sql`
    /* web_push_customer_name */
    select legal_name as "name" from customers where id = ${customerId}::uuid limit 1
  `) as Row[];
  const name = str(row?.name);
  return name || null;
}

/** First name of a user (e.g. the acting sales executive), for context-aware
 *  notification bodies like "Sandeep · Ravi Motors". Null when unknown. */
export async function executiveFirstName(sql: SqlClient, userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  const [row] = (await sql`
    /* web_push_executive_first_name */
    select name from users where id = ${userId}::uuid limit 1
  `) as Row[];
  const first = str(row?.name).trim().split(/\s+/)[0];
  return first || null;
}

export interface WebPushPayload {
  title: string;
  body: string;
  tag: string;
  url?: string;
}

/**
 * Send an encrypted push to every OFFICE user's subscription. Best-effort per
 * subscription; a 404/410 (gone) prunes that stale row. Office users are few, so
 * the fan-out stays well within the Workers subrequest budget. Call inside
 * `ctx.waitUntil` so it never blocks the response.
 */
export async function notifyOfficeWebPush(
  sql: SqlClient,
  vapid: VapidKeys,
  payload: WebPushPayload,
  nowSec: number,
): Promise<void> {
  const rows = (await sql`
    /* office_web_push_subscriptions */
    select s.endpoint, s.p256dh, s.auth
    from web_push_subscriptions s
    where exists (
      select 1 from user_roles ur join roles r on r.id = ur.role_id
      where ur.user_id = s.user_id and r.code in ('SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT')
    )
  `) as Row[];

  await Promise.allSettled(
    rows.map(async (row) => {
      const sub: PushSubscription = {
        endpoint: str(row.endpoint),
        p256dh: str(row.p256dh),
        auth: str(row.auth),
      };
      try {
        const res = await sendWebPush(sub, payload, vapid, nowSec);
        if (res.status === 404 || res.status === 410) {
          await pruneDeadWebPushSubscription(sql, sub.endpoint);
        }
      } catch {
        // transient network/push-service error — leave the subscription in place
      }
    }),
  );
}
