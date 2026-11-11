import type { SqlClient } from "../lib/db";
import type { ApiEnv } from "../types";
import { GRACE_DAYS, getBillingAccess } from "./billing-v2";

/**
 * Billing v2 payment reminders (email). In-app reminders are the overlay/banner
 * (see billing-guard-v2.tsx); this adds the two email nudges the owner asked for:
 *   - "due"   — on the 1st, when the month's charge becomes payable.
 *   - "grace" — on the last grace day (day 7), if still unpaid.
 * Each is sent at most once per month (a system_settings marker), only for a
 * PENDING month (free months never remind). No-op without RESEND_API_KEY.
 * GST invoices are issued manually — this is purely a payment nudge.
 */

const DEFAULT_FROM = "Sri Aparajita Billing <billing@updates.vardhansystems.in>";

type ReminderEnv = ApiEnv["Bindings"];

/** Active SUPER_ADMIN emails — the account owners who pay the bill. */
async function getAdminEmails(sql: SqlClient): Promise<string[]> {
  const rows = await sql`
    /* billing_reminder_admins */
    select distinct u.email
    from users u
    join user_roles ur on ur.user_id = u.id
    join roles r on r.id = ur.role_id
    where u.status = 'active' and r.code = 'SUPER_ADMIN'
      and u.email is not null and u.email <> ''
  `;
  return (rows as { email?: string }[]).map((r) => String(r.email)).filter(Boolean);
}

/** Claim a one-shot marker; returns true only the first time (so we send once
 *  and are safe against concurrent ticks). Release with `unmark` if the send
 *  fails, so it's retried on the next tick instead of being lost for the month. */
async function markOnce(sql: SqlClient, key: string): Promise<boolean> {
  const rows = await sql`
    /* billing_reminder_mark */
    insert into system_settings (key, value)
    values (${key}, ${new Date().toISOString()})
    on conflict (enterprise_id, key) do nothing
    returning key
  `;
  return rows.length > 0;
}

/** Release a claimed marker (the email send failed) so the next tick retries. */
async function unmark(sql: SqlClient, key: string): Promise<void> {
  await sql`/* billing_reminder_unmark */ delete from system_settings where key = ${key}`;
}

async function sendEmail(env: ReminderEnv, to: string[], subject: string, html: string): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.ALERT_FROM ?? DEFAULT_FROM, to, subject, html }),
  });
  return res.ok;
}

function money(paisa: number): string {
  return `₹${(paisa / 100).toLocaleString("en-IN")}`;
}

function emailHtml(opts: { heading: string; body: string; webUrl?: string }): string {
  const link = opts.webUrl
    ? `<p style="margin:16px 0 0;"><a href="${opts.webUrl}" style="color:#2563eb;">Open the app to pay →</a></p>`
    : "";
  return (
    `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;">` +
    `<h2 style="font-size:17px;color:#0f172a;margin:0 0 8px;">${opts.heading}</h2>` +
    `<p style="color:#334155;font-size:14px;line-height:1.5;margin:0;">${opts.body}</p>` +
    link +
    `<p style="color:#94a3b8;font-size:12px;margin:18px 0 0;">Sri Aparajita Distribution OS</p>` +
    `</div>`
  );
}

const monthName = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", month: "long", year: "numeric" }).format(new Date(iso));

/** One reminder tick (call from the scheduled handler). */
export async function runBillingReminders(
  sql: SqlClient,
  env: ReminderEnv,
): Promise<{ sent: string[] }> {
  const sent: string[] = [];
  if (!env.RESEND_API_KEY) return { sent };

  const access = await getBillingAccess(sql);
  const charge = access.current;
  if (!charge || charge.status !== "pending") return { sent }; // paid/free → nothing to nudge

  const admins = await getAdminEmails(sql);
  if (admins.length === 0) return { sent };

  const period = charge.periodStart.slice(0, 7); // YYYY-MM
  const label = monthName(charge.periodStart);
  const amount = money(charge.amountPaisa);
  const webUrl = env.REPORTS_WEB_BASE_URL ? `${env.REPORTS_WEB_BASE_URL}/settings?tab=billing` : undefined;

  // IST day-of-month, for the day-7 grace nudge.
  const [t] = (await sql`
    /* billing_reminder_day */
    select extract(day from (now() at time zone 'Asia/Kolkata'))::int as day
  `) as { day?: number }[];
  const day = Number(t?.day ?? 0);

  // Due reminder — first tick of the month a pending charge exists.
  const dueKey = `billing_reminded_due:${period}`;
  if (await markOnce(sql, dueKey)) {
    const ok = await sendEmail(env, admins, `Payment due — ${label}`, emailHtml({
      heading: `Your ${label} payment is due`,
      body: `The monthly payment of <strong>${amount}</strong> (for ${charge.seats} active user${charge.seats === 1 ? "" : "s"}) is now due. Please pay within 7 days to keep access uninterrupted.`,
      webUrl,
    }));
    if (ok) sent.push("due");
    else await unmark(sql, dueKey); // send failed → retry next tick
  }

  // Grace reminder — on/after day 7, still unpaid.
  const graceKey = `billing_reminded_grace:${period}`;
  if (day >= GRACE_DAYS && (await markOnce(sql, graceKey))) {
    const ok = await sendEmail(env, admins, `Final reminder — ${label} payment`, emailHtml({
      heading: `Last day of grace — ${label}`,
      body: `The ${label} payment of <strong>${amount}</strong> is still pending. Access will be paused today if it isn't paid. Please pay now to avoid interruption.`,
      webUrl,
    }));
    if (ok) sent.push("grace");
    else await unmark(sql, graceKey); // send failed → retry next tick
  }

  return { sent };
}
