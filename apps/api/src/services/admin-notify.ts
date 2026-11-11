import type { SqlClient } from "../lib/db";
import { sendExpoPush } from "./invoices";

type Row = Record<string, unknown>;
function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
}

/** ₹ with Indian grouping (whole rupees) for notification bodies. */
export function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export interface AdminNotifyInput {
  /** Feed/push type, e.g. "admin_order", "admin_collection", "admin_login". */
  type: string;
  title: string;
  body: string;
  /** Optional customer link so the mobile feed can tap through to the customer. */
  customerId?: string | null;
}

/**
 * Notify every active Super Admin of a field event (executive login, new order /
 * collection / visit / customer). Writes one `se_notifications` feed row per SA
 * (their mobile Alerts screen reads /me/notifications) AND pushes via FCM to
 * their registered devices. Best-effort; call inside `ctx.waitUntil`.
 */
export async function notifyAdmins(sql: SqlClient, input: AdminNotifyInput): Promise<void> {
  const admins = (await sql`
    /* admin_notify_recipients */
    select u.id
    from users u
    join user_roles ur on ur.user_id = u.id
    join roles r on r.id = ur.role_id
    where r.code = 'SUPER_ADMIN' and u.status = 'active'
  `) as Row[];
  const adminIds = admins.map((a) => str(a.id)).filter(Boolean);
  if (adminIds.length === 0) return;

  // One feed row per SA (drives the Alerts screen + unread state).
  await sql`
    /* admin_notify_insert */
    insert into se_notifications (user_id, type, title, body, customer_id)
    select id, ${input.type}, ${input.title}, ${input.body}, ${input.customerId ?? null}::uuid
    from unnest(${adminIds}::uuid[]) as id
  `;

  // FCM to their devices.
  const tokenRows = (await sql`
    /* admin_notify_tokens */
    select token from push_tokens where user_id = any(${adminIds}::uuid[])
  `) as Row[];
  const tokens = tokenRows.map((t) => str(t.token)).filter(Boolean);
  if (tokens.length > 0) {
    await sendExpoPush(tokens, input.title, input.body, {
      type: input.type,
      customerId: input.customerId ?? null,
    });
  }
}

/** A timestamp as IST clock time, e.g. "3:06 am"; empty string when absent. */
function istTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(d)
    .toLowerCase();
}

/**
 * Notify every active Super Admin that a sales executive started or ended their
 * day — one `se_notifications` feed row per SA (their mobile Alerts screen) plus
 * an Expo push. The body names WHO ended the day: the SE themselves on a manual
 * end, or the system on the midnight safety cap. `kind`:
 *  - "start"      → the SE tapped Start day.
 *  - "manual_end" → the SE tapped End day.
 *  - "auto_end"   → the midnight cap closed a forgotten day (ended by the system).
 * Best-effort; call inside waitUntilSafe / ctx.waitUntil.
 */
export async function notifyAdminsOfDayEvent(
  sql: SqlClient,
  input: { seUserId: string; kind: "start" | "manual_end" | "auto_end"; at: string | null },
): Promise<void> {
  const [u] = (await sql`
    /* day_event_se_name */
    select name from users where id = ${input.seUserId}::uuid
  `) as Row[];
  const name = str(u?.name) || "A sales executive";
  const time = istTime(input.at);
  const atSuffix = time ? ` at ${time}` : "";

  let type: string;
  let title: string;
  let body: string;
  if (input.kind === "start") {
    type = "admin_day_start";
    title = "Day started";
    body = `${name} started their day${atSuffix}.`;
  } else if (input.kind === "manual_end") {
    type = "admin_day_end";
    title = "Day ended";
    body = `${name} ended their day${atSuffix}.`;
  } else {
    type = "admin_day_end";
    title = "Day auto-closed";
    body = `${name}'s day was auto-closed by the system at midnight — they didn't tap End day.`;
  }

  await notifyAdmins(sql, { type, title, body });
}
