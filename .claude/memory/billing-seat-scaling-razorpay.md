---
name: billing-seat-scaling-razorpay
description: How seat increases bill on Razorpay — domestic cards CANNOT update quantity; the add-on auto-reconcile system was rejected; report-only for now
metadata:
  node_type: memory
  type: project
  originSessionId: 7cfcb334-6117-46c9-8244-11746a5a70bf
  modified: 2026-09-30T18:49:59.977Z
---

Billing is seat-based: ₹708/active user (plan `plan_Ti8Qx1OyPGV2lQ`, 70800 paisa incl
18% GST). `quantity` is locked at subscribe time to the active-user count. When the client
later adds users, **nothing bills automatically today** — Razorpay keeps charging the
original quantity; `getBillingStatus` only surfaces the `activeUsers` vs `quantity` drift.

**Hard Razorpay constraint (confirmed in docs 2026-09-30):** "For Subscriptions created
using domestic cards, you can update only the offer that is linked to them" → quantity/plan/
start_at are FROZEN on a domestic-card subscription. So you cannot bump 4→7 seats on the
live sub. UPI Autopay & e-mandate quantity-update is **NOT confirmed** from public docs
(one conflicting third-party claim says UPI subs can't be updated at all) — verify with
Razorpay support before relying on it. Mandate ceilings if switching: UPI frictionless
≤₹15,000/debit (₹1L cap); e-mandate ≤₹1 crore.

The two compliant ways to charge extra seats: (a) **add-ons** (`POST /subscriptions/:id/
addons`, rides existing mandate, fully automatic, but one-time per invoice so a cron must
re-post the delta every cycle, bounded by mandate max); (b) **cancel + recreate** at cycle
end (clean permanent base, but needs the client to re-authorize — OTP + refundable ₹5 — so
it can't be fully automatic).

**PIVOT (2026-09-30):** abandoned the Razorpay **Subscriptions** model entirely and moved to
**standard one-time monthly payments** (Billing v2) — because subscriptions can't reconcile
seats (mandate quantity is frozen). Now each calendar month the app generates a fresh charge =
₹708 × active seats (counted at generation = the reconcile) + a Razorpay **Order**, paid via
in-app Checkout. Decisions: pay-in-advance, calendar month, no proration, first month free
(through end of next calendar month), 7-day grace then overlay block, any web role can pay,
GST invoices **manual/out of app**. FULLY BUILT & retired the old model (2026-10-01): billing-v2 service/routes/webhook/cron/gate +
web (overlay `billing-guard-v2`, pay `use-pay-checkout`, `billing-card-v2` in Settings). Migrations
`0089` (tables) + `0090` (DROP subscriptions/subscription_events) applied to prod. Old subscription
code deleted (`services/billing.ts`, `routes/billing.ts`, old web billing files, razorpay subscription
fns). Toggle `system_settings.billing_free_first_month` ('false'=no free month → pay-first). Reset via
`POST /billing/reset` + "Start billing fresh" button in Settings. Orders created lazily on Pay click.
GST invoices manual. Full design: `docs/BILLING-STANDARD-PAYMENT-ARCHITECTURE.md`. **Testing state:
free-month OFF, Razorpay on TEST keys, Oct = payable ₹708. Re-enable free month + switch to LIVE keys
before real onboarding; BILLING_ENFORCED still false.** See [[user-deletion-removed]] — seats drop via deactivation.
