# Razorpay Subscriptions — Test-Mode Checklist & Edge-Case Coverage

Feature branch: `feat/razorpay-team-subscriptions`. One org-level subscription
(SUPER_ADMIN pays; quantity = active users). ₹708/user/month (₹600 + 18% GST =
70800 paisa). **Test mode only** until go-live.

> **Model = pay-first (updated 2026-09-30).** Access is granted ONLY once a
> payment succeeds (`active`/`authenticated`, or a paid cycle still running under
> grace/cancellation). A `created` subscription (checkout started, not paid) and
> *no subscription at all* are **blocked** — abandoning the Razorpay overlay can
> no longer unlock the app. Newer endpoints: `POST /billing/subscription/discard`
> (abandon an unpaid `created` so you can start over — it checks Razorpay first
> and refuses to discard a *paid* sub), `POST /billing/subscription/sync`
> (self-heal from Razorpay when a webhook is missed). Subscriptions are created
> with `expire_by` (24h) so abandoned checkouts auto-expire. Access is evaluated
> across ALL subscriptions, so a discarded/expired row never shadows a still-valid
> paid cycle. **Go-live steps live in `BILLING-GO-LIVE.md`.**

## Config used for testing
- Secrets (root `.env` for local `wrangler dev`; `wrangler secret put` for deploy):
  `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
- Vars: `RAZORPAY_PLAN_ID` (current TEST plan `plan_ThwTTAtjd1eDA1`; a **live** plan is
  created at go-live — see `BILLING-GO-LIVE.md`), `GRACE_PERIOD_HOURS` (default 168;
  set small e.g. `0.05` to test expiry fast), `BILLING_ENFORCED` (default off; `true` = live 402).
- Razorpay TEST webhook → subscribe to: `subscription.activated/charged/pending/halted/
  cancelled/completed/updated`, `payment.failed`.

## Tooling
- **Signed fake webhook** (no waiting a month):
  `node scripts/razorpay-fake-webhook.mjs <event> --sub=sub_X --end=+30d --event-id=evt_Y`
- **Automated lifecycle + edge cases** (parks/restores the real sub, asserts DB):
  `bash scripts/razorpay-e2e-lifecycle.sh`  ← all assertions PASS.
- **Local webhook delivery:** Razorpay can't reach `localhost`. Either run the fake-webhook
  script, OR expose `localhost:8787` via a tunnel (cloudflared/ngrok) and point the TEST
  webhook there. In production the deployed Worker URL receives webhooks directly.

## Edge-case coverage (all 20 from the spec)

| # | Case | How verified |
|---|------|--------------|
| 1 | Pay, tab closed before success handler | Webhook activates independently — live run + `applyWebhookEvent`; `/subscription/sync` self-heals a missed webhook |
| 2 | Checkout ok, webhook delayed → "Activating…" polls | `useSubscribeCheckout` poll loop; Billing page live |
| 3 | Duplicate webhook → processed once | Unit (`billing.test`) + lifecycle script |
| 4 | Out-of-order (stale) webhook → no regression | Unit + lifecycle script (stale end ignored) |
| 5 | Invalid/missing signature → 400, nothing written | Unit (`razorpay.test`, `razorpay-webhook.test`) + lifecycle script |
| 6 | Fail then retry succeeds day 3 → grace cleared | Unit + lifecycle script (pending→charged clears grace) |
| 7 | No pay for 7 days → block at exactly grace end | `computeAccess` unit + live overlay (forced past-grace) |
| 8 | Halt on day 4 → access until day 7 | Unit + lifecycle script (halted retains grace) |
| 9 | Blocked, admin pays → unblock without re-login | Live: overlay + poll clears on active |
| 10 | Blocked non-admin → dialog w/o Pay + API 402 | `BillingGuard` isAdmin branch; `billing-gate` unit (402) |
| 11 | Dialog can't be bypassed (Esc/outside/back/DOM) | Overlay traps + **server 402 gate** (real enforcement) |
| 12 | Admin cancels → access until current_end | Unit (`cancelOrgSubscription`) + lifecycle (cancelled) |
| 13 | Cancel during grace | `computeAccess` (cancelled uses current_end) |
| 14 | Seat up+down same month → final count next cycle | Seat-drift notice; quantity recomputed on re-subscribe |
| 15 | Double-click / two admins subscribe | One-live partial unique index (proven) + orphan-cancel |
| 16 | Customer revokes UPI mandate | Razorpay fires `subscription.cancelled` → cancel path |
| 17 | Amount > UPI ₹15k limit (22+ users) | Documented; cap is 8 users (₹5,664) — under the limit |
| 18 | Test vs live keys never mixed | `rzp_test_`/`rzp_live_` guarded; separate secrets |
| 19 | First-payment failure / abandoned checkout → no access | **Pay-first: `created` is BLOCKED** (no access until paid); retry via *Complete payment* or *Discard & start over* (unit + live) |
| 21 | Abandon Razorpay overlay → not a dead end | `created` shows *Complete payment* **and** *Discard & start over*; discard clears it (live-verified) |
| 22 | Discard must not cancel a PAID sub (stale webhook) | `discardOrgSubscription` fetches Razorpay first; refuses + reconciles if `paid_count>0`/active (unit + live) |
| 23 | Discarded/expired row must not shadow a paid cycle | Access computed across ALL subs (`accessAcross`); unit `getBillingStatus` + live |
| 20 | Timezone boundary (grace near midnight IST) | UTC storage; IST only for display |

## Manual test-mode rehearsal (do before go-live)
1. **Subscribe:** Billing → Subscribe → complete Checkout with test UPI `success@razorpay`
   (or card `4111 1111 1111 1111`). Confirm status → **active**, "Paid until" shows.
2. **Grace:** set `GRACE_PERIOD_HOURS=0.05` (~3 min), restart API, then
   `razorpay-fake-webhook.mjs subscription.pending --sub=<real> --end=+30d`. Confirm the
   amber grace banner; wait 3 min → reload → **blocking overlay** appears.
3. **Server 402:** set `BILLING_ENFORCED=true`, restart API; while blocked, confirm app API
   calls return 402 (e.g. Customers list fails) while `/billing/*` still works.
4. **Unblock:** admin clicks **Pay now** in the overlay → complete Checkout →
   `razorpay-fake-webhook.mjs subscription.charged --end=+30d` (or real webhook via tunnel) →
   overlay clears **without re-login**.
5. **Non-admin:** log in as a MANAGER while blocked → overlay shows **no Pay button** +
   "contact your administrator".
6. **Cancel:** admin → Cancel subscription → confirm "access continues until <date>".

## Go-live checklist

**→ Full ordered runbook: `BILLING-GO-LIVE.md`.** Summary (order matters):
- [ ] Merge `feat/razorpay-team-subscriptions` → `main`; tests + typecheck green.
- [ ] Create a **live** Razorpay plan (₹708/70800 paisa) and set `RAZORPAY_PLAN_ID`.
- [ ] `wrangler secret put RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET` (LIVE) on the API Worker.
- [ ] Point the **live** Razorpay webhook at `…/api/v1/webhooks/razorpay`; subscribe to the 8 events; send a test event → 200.
- [ ] The web reads `keyId` from the API response (no separate web secret needed).
- [ ] **Deploy API + Web with `BILLING_ENFORCED` OFF first.**
- [ ] Client subscribes + pays on LIVE keys → verify `active` via the live webhook.
- [ ] **Only then** set `BILLING_ENFORCED=true` (+ `GRACE_PERIOD_HOURS=168`) on the worker and redeploy.
      ⚠️ Enforcing before an active subscription exists 402-locks the whole app (pay-first).
- [ ] Rehearse on live: abandon→discard, missed-webhook→sync, cancel→access-until-date, multi-sub no-shadow.
