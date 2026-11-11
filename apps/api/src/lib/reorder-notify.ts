import type { Context } from "hono";
import type { ApiEnv } from "../types";
import type { SqlClient } from "./db";
import { waitUntilSafe } from "./wait-until";
import { checkReorder, superAdminPushTokens, type ReorderKey } from "../services/stock-reorder";
import { sendExpoPush } from "../services/invoices";

/**
 * Real-time low-stock notify, called by every stock-movement route with the
 * (godown, product, pack) balances the movement touched.
 *
 * The alert + de-dup-state writes are AWAITED (so the in-app web Alert is created
 * reliably before the response returns). The notification then goes to every
 * SUPER_ADMIN's mobile app as an Expo push — the same channel SEs get invoice
 * notifications on — fired after the response via `waitUntilSafe`. Safe to call
 * with keys that didn't cross: it simply does nothing.
 */
export async function notifyReorder(c: Context<ApiEnv>, sql: SqlClient, keys: ReorderKey[]): Promise<void> {
  const pushes = await checkReorder(sql, keys);
  if (pushes.length === 0) return;
  const tokens = await superAdminPushTokens(sql);
  if (tokens.length === 0) return;
  waitUntilSafe(
    c,
    Promise.all(pushes.map((p) => sendExpoPush(tokens, p.title, p.body, { type: "low_stock", url: "/alerts" }))),
  );
}
