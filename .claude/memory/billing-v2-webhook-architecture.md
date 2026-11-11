---
name: billing-v2-webhook-architecture
description: "Sri Aparajita billing = one-time Razorpay orders, webhook is the ONLY paid-flip path — NOW VERIFIED FIRING in prod (2026-11-08 ₹1 test: valid sig→200, billing_payment_events got 2 rows); BILLING_ENFORCED flipped on + amber blocked-screen overlay CONFIRMED LIVE; first real paying month Nov 2026 still unpaid (₹4,248/6 seats); remaining deferred: /confirm fallback + reconcile cron + invoice-on-pay"
metadata:
  node_type: memory
  type: project
  originSessionId: 54aabb46-92ca-464e-b6d4-89e2daf56831
  modified: 2026-11-08T12:46:59.950Z
---

Diagnosed 2026-11-06 with the Razorpay MCP (read-only) + code trace. **User will WAIT for Sri Aparajita's first real payment, then revisit — nothing was changed.**

## How billing works now (apps/api)
- **Model:** one-time **monthly Razorpay orders**, amount = active-seats × ₹708 (GST-inclusive, `chargeAmountPaisa`), `billing_charges` (status `free|pending|paid|void`, cols `razorpay_order_id`/`razorpay_payment_id`/`paid_at`, unique on `period_start`). Charge row made by `ensureCurrentCharge`; order by `ensureOrderForCharge` (cron near month start + on `/pay`). **No mandate / not subscriptions** (`razorpay.ts:130` `createOrder`; comment "No mandate is created"). This is a migration AWAY from the old subscription/e-mandate model that [[razorpay-pause-resume-feature-gate]] and [[billing-seat-scaling-razorpay]] describe — those notes predate the one-time-order rewrite.
- **Paid-flip = the webhook ONLY.** `POST /api/v1/webhooks/razorpay` (`routes/razorpay-webhook.ts`, mounted `index.ts:107`) → verify HMAC over raw body + require `x-razorpay-event-id` → `applyPaymentWebhook` (`services/billing-v2.ts:439`): acts only on `payment.captured`/`order.paid` → `recordPaymentEventOnce` (INSERT into **`billing_payment_events`** `on conflict(event_id) do nothing returning` → dedup) → if fresh → `markChargePaidByOrder` (`update billing_charges set status='paid'… where razorpay_order_id=? and status='pending'`).
- **`POST /billing/confirm` is UI-ONLY** — verifies the Checkout signature and returns `{verified:true}` but **does NOT flip the charge** (its comment: "The webhook does the authoritative flip + invoice").
- **Invoice-on-payment is NOT wired** — `applyPaymentWebhook` returns `chargeId` "so the caller can generate the GST invoice," but the webhook route generates nothing. So a successful payment produces **no** subscription invoice automatically today.

## `billing_payment_events` (migration 0001: `event_id` PK, `kind`, `created_at`)
Purpose = **webhook exactly-once idempotency** (Razorpay delivers at-least-once; dedup on `x-razorpay-event-id`). **Currently empty** because no real payment has ever traversed the webhook. **Redundant for today's only side-effect** (`markChargePaidByOrder` is itself idempotent via the `status='pending'` guard — a replay updates 0 rows). It **earns its keep only once a NON-idempotent side-effect** hangs off the webhook (generate+number a GST invoice, send a receipt, write a payments-ledger row) — exactly what the [[saas-distribution-os-plan]] admin cockpit will add. As built it's also a weak audit log (no amount/order/charge, just event_id+kind+created_at).

## Live Razorpay evidence (full account = only 11 orders)
- Seat-billing orders (`notes.kind='seat-billing'`): **Oct 2026** `order_TiLqPYzpnvtOjR` ₹708 (1 seat) — **unpaid/created**; **Nov 2026** `order_Tvzfr97V6A8fEi` AND `order_TuphqUrTDEeRj2`, both ₹4,248 (6 seats) — **both unpaid/created**.
- The only *captured* payments: 3× ₹708 **legacy subscription** card charges (saved-card `token_id`, `invoice_id`, "Monthly subscription — 1 user(s)") + 3× tiny **QR/UPI test** (₹1/₹11/₹1). **All previous activity = testing.**
- **Sri Aparajita is the client; their FIRST real paying month = Nov 2026 (this month), charge ₹4,248 / 6 seats, still UNPAID.**
- **Two Nov orders = the user clicked Pay twice, never completed payment.** `orderIsUsable` (`razorpay.ts:151`) should reuse a `created`/same-amount order; the 2nd click likely hit a transient `GET /orders/{id}` failure → `catch`→false→regenerated. DB now points to the newest (`order_Tvzfr`); `order_Tuphq` is orphaned.

## ✅ WEBHOOK VERIFIED FIRING + ENFORCEMENT LIVE (2026-11-08)
**The webhook paid-flip is PROVEN in prod.** Verified end-to-end via a ₹1 self-test:
- `wrangler tail` showed `Razorpay-Webhook/v1` POSTs to `…/api/v1/webhooks/razorpay` with **valid `x-razorpay-signature` → 200** (not 400 ⇒ `RAZORPAY_WEBHOOK_SECRET` on the deployed Worker MATCHES the dashboard secret).
- Razorpay webhook is **Enabled**, correct URL, **Live mode**, with `payment.captured` + `order.paid` among its 28 subscribed events (confirmed from the dashboard screenshots).
- `billing_payment_events` gained 2 real rows: `TxgUlkiBECPtwD` (payment.captured) + `TxgUlxlTODJkwT` (order.paid) at 2026-11-08T12:40:32 — so the dedup-ledger path executes for real now.
- **⇒ Risk #1 (paid-flip unproven) and #2 (webhook config unverified) are ELIMINATED. A paying client WILL be unblocked automatically.**
- **`BILLING_ENFORCED` flipped to enforce (user's action, 2026-11-08) + overlay CONFIRMED LIVE on prod** by the user — Sri Aparajita now hard-blocked (Nov ₹4,248 unpaid, grace ended Nov 7) until they pay. Safe to enforce *because* the webhook is proven.
- TODO housekeeping: refund the ₹1 test payment (Razorpay → Transactions).

## Remaining risks (lower now)
3. **Stale-checkout mismatch** — if an older Checkout (order `Tuphq`) is paid while DB stores the newer order (`Tvzfr`), the webhook's `order_id` won't match → 0 rows flipped → paid-but-pending. (The `/confirm` fallback (b) would cover this — still deferred.)
4. **No auto invoice** on payment.

## Proposed fix set (NOT done — deferred until after the first real payment)
- **(a)** Verify + enable the **webhook** (user's action; I'll give steps — won't touch Razorpay settings myself). Non-negotiable before relying on it.
- **(b)** Make **`/confirm` a fallback** that also flips the charge to `paid` (it already verifies the signature) so a missed/late webhook can't strand a paid customer; still idempotent.
- **(c)** **Reconcile cron** — for any `pending` charge with an order, poll Razorpay order status and flip if paid (catches missed webhooks + the stale-checkout mismatch).
- **(d)** Decide **invoice-on-payment**: auto-generate the GST subscription invoice on success, or keep manual.
- Also: this billing code is what [[saas-distribution-os-plan]] **clones into Distribution OS** — so proving/fixing it here de-risks the SaaS build too.

Key files: `apps/api/src/services/billing-v2.ts`, `apps/api/src/routes/razorpay-webhook.ts`, `apps/api/src/routes/billing-v2.ts` (`/pay`, `/confirm`), `apps/api/src/lib/razorpay.ts`. Related: [[local-dev-uses-live-prod]] (local hits prod Razorpay + DB), [[billing-seat-scaling-razorpay]], [[razorpay-pause-resume-feature-gate]], [[saas-distribution-os-plan]].

## Enforcement / grace overlay + blocked-screen redesign (2026-11-08)

**Grace + block state machine (correct, unit-tested) — `services/billing-v2.ts`:** `GRACE_DAYS = 7`; `accessUntil = paidThrough + 7 days` where paidThrough = IST end-of-day of the latest paid/free month-end; `computeAccess` → `blocked` once `now > accessUntil` and the current month isn't paid/free. For Sri Aparajita: billing_charges Sep=free, **Oct=free (period_end Oct 31), Nov=pending (6 seats, ₹4,248)** → paidThrough=Oct 31 → grace = 1st–7th → **blocked from the 8th**. So on Nov 8 the API correctly reports `blocked:true`.

**ROOT CAUSE (FIXED 2026-11-08): the hard-block overlay never showed on PROD because `BILLING_ENFORCED="false"` was a SECRET on the prod Worker.** The web shows the overlay only when `hardBlock = enforced && blocked`; `enforced` = `/billing/access`'s `enforced` field = `isBillingEnforced(env)` = `env.BILLING_ENFORCED !== "false"`. The grace **banner** ignores `enforced` (so it still showed). `BILLING_ENFORCED` is NOT in `wrangler.jsonc` vars and doesn't appear in deploy output, but `wrangler secret list` shows it IS a prod secret. Root `.env` also has `BILLING_ENFORCED=false` (local; keep local off). **RESOLVED: user flipped the prod secret to enforce on 2026-11-08 (after the webhook was proven) and CONFIRMED the overlay now renders live on prod.** Takes effect on next request, no redeploy. To revert for testing: set the secret back to `false`.

**Blocked-screen redesign (IMPLEMENTED + COMMITTED a9839c0 + DEPLOYED api+web 2026-11-08):** `apps/web/src/features/billing/billing-blocked-screen.tsx` redesigned — **amber card** (`amber-50` fill + amber-200 border/amber text, matched to the grace banner), **no icons**, reassurance copy ("your data stays safe, access returns the moment it's confirmed"), white summary panel (month / seats / **₹4,248** in amber), blue Pay button, "Secured by Razorpay · incl 18% GST", and a **support block**: Call **+91 63048 00595**, email **vishnuvardhan@vardhansystems.in**, **8am–4pm every day** (tel:/mailto: links). Added an inert **`StaticChrome`** backdrop that reuses the real `buildNavSections(role)` (pure, data-free) so the dimmed sidebar+topbar+skeleton sit frosted behind the card; `(dashboard)/layout.tsx` now passes `role` (narrowed via `isWebRole`). Theme-aware, `tsc --noEmit` clean. Artifact mockups: Payment Required + Payment Required Amber. **Now LIVE on prod** (committed a9839c0, api+web deployed, `BILLING_ENFORCED` enforced) — user confirmed the amber overlay renders. Design pref captured in [[feedback-ask-with-options]].
