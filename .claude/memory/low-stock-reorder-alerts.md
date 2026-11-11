---
name: low-stock-reorder-alerts
description: "Low-stock reorder alerting: a stock movement dropping a SKU to/below its reorder level raises a web Alert + sends an Expo MOBILE push to all SUPER_ADMINs (the SE-invoice channel), once per crossing, auto-closing on restock. Web/VAPID push was tried and ABANDONED (unreliable on phones)."
metadata:
  node_type: memory
  type: project
  originSessionId: 87018263-5262-4535-aa57-65bc1d4b7245
  modified: 2026-11-08T17:06:36.305Z
---

Low-stock reorder alerts, 2026-11-08. Committed `a24a7a9` (first cut) + `2808137` (Expo switch + Sonar fixes); **deployed API + Web**. Migration `0021` applied to prod.

## What it does
On any stock movement, if a `(godown, product, pack)` balance is now **`qty <= reorder_level`** (reorder set on `stock_balances`), it:
1. Raises an **OPEN `low_stock` web Alert** (visible on `/alerts`, SUPER_ADMIN+MANAGER), and
2. Sends an **Expo mobile push to every SUPER_ADMIN with a registered device** — the SAME channel SEs get invoice pushes on (`push_tokens` + `sendExpoPush`).

Fires **once per downward crossing** — `stock_reorder_state` (migration 0021, PK `location_id/product_id/pack_size_litres`, `open_alert_id`) de-dups; stays silent while already low; **auto-closes** the alert + re-arms when restocked above reorder. SKUs with no reorder level are ignored. "hits or below" = `<=` (note the on-page LOW badge uses strict `<`).

## Code
- `apps/api/src/services/stock-reorder.ts` — `checkReorder()` (scan + alert/state writes in one batch, returns push payloads), `superAdminPushTokens()`, `keysForInvoice()`.
- `apps/api/src/lib/reorder-notify.ts` — `notifyReorder(c, sql, keys)`: awaits `checkReorder` (so the web Alert is reliable) then fans the push out to super-admin tokens via `sendExpoPush` in `waitUntilSafe`.
- Wired real-time into every stock-moving route: GRN / transfer / adjustment / opening (`routes/stock.ts`), generate / edit / cancel invoice (`routes/invoices.ts`), sales-return create / edit (`routes/sales-returns.ts`). Edit/cancel invoice derive keys via `keysForInvoice`.
- 18 unit tests; full API suite green (1315).

## ⚠️ Channel lesson — "mobile" means the Expo app, not web push
The user wanted the notification on the Super Admin's **phone, like SEs get for invoices** = **Expo app push**. The first build mistakenly used **Web Push** (VAPID / `notifyOfficeWebPush`) because "mobile" was read as browser/PWA push. That FAILED on phones: diagnostics proved the server side was perfect (**FCM returned 201**), but the device never displayed it — browser/PWA push on phones depends on OS notification settings, Chrome toggles, and (iOS) the site being Added-to-Home-Screen as a PWA. **Expo app push just works** (native app already installed, same pipe as SE invoices). Switched in `2808137`.

## VAPID / web-push cleanup (removed)
VAPID keys (generated during the web-push detour) were **removed** from the prod API secrets + local `.env`; the 2 test `web_push_subscriptions` deleted. So browser web push is back to "not configured" as before — `notifyOfficeWebPush` (still used by orders/collections/visits) degrades to a no-op, which it always did. Don't re-add VAPID unless browser web push is actually wanted.

Related: [[mobile-session-device-labels]] (push SENDING was SALES_EXECUTIVE-only before this — now super admins too, for low-stock), [[stock-phase2-batch-lots]], [[local-dev-uses-live-prod]], [[stock-home-cards-design-a]].
