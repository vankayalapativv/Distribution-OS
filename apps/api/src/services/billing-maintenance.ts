import { createScopedSqlClient, type SqlClient } from "../lib/db";
import type { ApiEnv } from "../types";
import { ensureCurrentCharge } from "./billing-v2";
import { runBillingReminders } from "./billing-reminders";

/**
 * Multi-enterprise billing cron (Phase 3 billing wiring).
 *
 * The scheduled handler has only the OWNER (unscoped) client, but billing is
 * per-enterprise: each active enterprise's charge must be generated against ITS
 * own active-seat count and ITS own price, and reminders sent to ITS own admins.
 * So we list the active enterprises and run the per-enterprise maintenance
 * (ensureCurrentCharge + runBillingReminders) under a SCOPED client for each, so
 * RLS isolates every read/write. One enterprise failing never stops the others.
 */
export async function runBillingMaintenance(
  base: SqlClient,
  env: ApiEnv["Bindings"],
): Promise<{ enterprises: number; created: number; reminded: number }> {
  const rows = (await base`
    /* billing_active_enterprises */
    select id from enterprises where status = 'active'
  `) as Array<{ id: string }>;

  let created = 0;
  let reminded = 0;
  for (const { id } of rows) {
    const sql = createScopedSqlClient(base, String(id));
    try {
      const r = await ensureCurrentCharge(sql, env);
      if (r.created) created++;
    } catch (e) {
      console.error("[billing] ensureCurrentCharge failed for enterprise", id, e instanceof Error ? e.stack : e);
    }
    try {
      const rr = await runBillingReminders(sql, env);
      reminded += rr.sent.length;
    } catch (e) {
      console.error("[billing] reminders failed for enterprise", id, e instanceof Error ? e.stack : e);
    }
  }
  return { enterprises: rows.length, created, reminded };
}
