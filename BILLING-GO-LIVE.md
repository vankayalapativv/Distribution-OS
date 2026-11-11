# Billing — Production Go-Live Runbook

What it takes to move the Razorpay team subscription from TEST to LIVE, safely.
Read top to bottom; the **order matters** (pay-first enforcement can lock the
client out if enabled too early). Companion docs: `DEPLOY_GUIDE.md` (how to
deploy API/Web), `BILLING_TEST_CHECKLIST.md` (edge-case coverage + rehearsal).

Current model (as shipped): **pay-first**. The app is blocked whenever there is
no *active/paid* subscription — a `created` (checkout started, not paid) or no
subscription at all does **not** grant access. Enforcement (HTTP 402) is gated
by `BILLING_ENFORCED`. The Razorpay webhook is the source of truth; a missed
webhook is self-healed by `POST /billing/subscription/sync` and the daily
reconcile cron.

Endpoints (all `/api/v1`): `GET /billing/status`, `POST /billing/subscription`
(create), `/subscription/cancel`, `/subscription/discard` (abandon an unpaid
`created`), `/subscription/sync` (reconcile from Razorpay), `/checkout/verify`,
and the webhook receiver `POST /webhooks/razorpay`.

---

## 0. Pre-flight (state today)

- [ ] Tests green: `cd apps/api && npx vitest run` (581+) and `npx tsc --noEmit`.
- [ ] Web typechecks: `cd apps/web && npx tsc --noEmit`.
- [ ] Billing code is committed and the branch **`feat/razorpay-team-subscriptions`
      is merged to `main`** (deploys should come from `main`).
- [ ] `BILLING_ENFORCED` is **OFF** on the deployed API worker (it currently
      lives only in local `.env`; prod has never had it set → prod enforcement
      is off today). Keep it off until Step 4.
- [ ] There is ONE shared Neon database for prod + local. Subscription state is
      shared; only the `BILLING_ENFORCED` flag differs per environment.

## 1. Razorpay LIVE account setup

- [ ] Complete Razorpay KYC / activation so the account can accept **live**
      payments and **UPI AutoPay** (e-mandate) subscriptions.
- [ ] Create a **live plan**: ₹708/user/month = `70800` paisa, monthly interval.
      Record its `plan_id`.
- [ ] Generate **live** API keys (`rzp_live_...`) and a **live webhook secret**.
- [ ] Never mix test and live: live keys only on the deployed worker; test keys
      stay in local `.env`.

## 2. Configure the API worker (secrets + vars) — enforcement still OFF

From `apps/api`:

```bash
npx wrangler secret put RAZORPAY_KEY_ID          # rzp_live_...
npx wrangler secret put RAZORPAY_KEY_SECRET      # live secret
npx wrangler secret put RAZORPAY_WEBHOOK_SECRET  # live webhook signing secret
npx wrangler secret put RAZORPAY_PLAN_ID         # live plan_...  (or set as a var)
npx wrangler secret put GRACE_PERIOD_HOURS       # 168  (7 days)
# DO NOT set BILLING_ENFORCED yet — that is Step 4.
npx wrangler secret list                          # verify all present
```

> `RAZORPAY_PLAN_ID` / `GRACE_PERIOD_HOURS` may be `vars` in `wrangler.jsonc`
> instead of secrets — either works. Keep the two **keys + webhook secret** as
> secrets. The web app needs **no** Razorpay secret: it reads the public
> `keyId` from `GET /billing/status`.

## 3. Register the LIVE webhook

- [ ] In the Razorpay **live** dashboard → Webhooks → add:
      `https://distribution-os-api.vardhansystems.workers.dev/api/v1/webhooks/razorpay`
- [ ] Signing secret = the `RAZORPAY_WEBHOOK_SECRET` you set in Step 2.
- [ ] Subscribe to these 8 events:
      `subscription.activated`, `subscription.charged`, `subscription.pending`,
      `subscription.halted`, `subscription.cancelled`, `subscription.completed`,
      `subscription.updated`, `payment.failed`.
- [ ] Send a test event from the dashboard → expect **HTTP 200** and a row in
      `subscription_events` (idempotency table).

## 4. Deploy, subscribe, THEN enforce (the critical order)

1. [ ] **Deploy API + Web** from `main` (see `DEPLOY_GUIDE.md`), enforcement OFF.
2. [ ] As SUPER_ADMIN on the live site, **Subscribe** and complete a **real**
       payment (UPI AutoPay). Watch `npx wrangler tail api` for
       `subscription.activated` / `subscription.charged`.
3. [ ] Confirm `GET /billing/status` → `state: "active"`, `blocked: false`,
       correct `quantity` (= active users) and `currentEnd`.
4. [ ] **Only now** enable enforcement:
       `cd apps/api && npx wrangler secret put BILLING_ENFORCED` → `true`, then
       `npx wrangler deploy`.
5. [ ] Sanity: app works while active; `/billing/*`, `/me`, `/status`, `/health`,
       `/webhooks` remain reachable even if blocked (so an admin can always pay).

> ⚠️ If `BILLING_ENFORCED=true` is set **before** an active subscription exists,
> every app API call 402s and the client is locked out (pay-first). Always
> activate first, enforce second.

## 5. Verify the new flows on LIVE (money is real)

- [ ] **Abandon checkout:** Subscribe → close the Razorpay overlay → Billing
      shows *Complete payment* **and** *Discard & start over*; the app is not a
      dead end. Discard → reverts cleanly.
- [ ] **Discard safety:** discard must refuse a subscription that Razorpay shows
      as paid (it reconciles instead of cancelling). Never cancel a paid sub.
- [ ] **Missed webhook:** if a webhook is delayed, "Already paid? Refresh
      payment status" (sync) activates from Razorpay. Confirm it works.
- [ ] **Multi-subscription:** a discarded/expired checkout must **not** shadow a
      still-valid paid cycle (access stays until the paid `current_end`).
- [ ] **Cancel:** access continues until `current_end`, then blocks.
- [ ] **Grace:** a failed renewal (`pending`/`halted`) keeps access until
      `grace_until` (7 days), shows the amber banner, then blocks.
- [ ] **Reconcile cron** (`*/3` in `wrangler.jsonc`, self-gated daily) is the
      webhook safety-net — confirm it runs in prod logs.

## 6. Operational

- [ ] `wrangler tail api` during the first live cycle; watch for webhook 4xx
      (signature mismatch = wrong secret) and any `RAZORPAY_ERROR`.
- [ ] Rollback plan: `wrangler deployments list` → `wrangler rollback` (code
      only; DB migrations are additive and not rolled back).
- [ ] Keep test keys in local `.env`; production uses the worker secrets only.

---

## Known follow-ups (not blockers, decide deliberately)

- **Auto-renewal is currently OFF** on the live-DB subscription (a test-discard
  cancelled it during development); access runs to its `current_end`. The client
  must **Resubscribe** for ongoing billing. Decide: resubscribe now (overlaps the
  paid cycle) or near the end date.
- **Onboarding is paywall-first:** pay-first blocks an org with *no* subscription,
  not just lapsed ones. Correct for a paid product; confirm it's intended for any
  future new tenant.
- **UPI AutoPay cap:** a single UPI mandate is capped at ₹15,000; at ₹708/user the
  8-user cap (₹5,664) stays well under it. Revisit if the user cap ever rises.
