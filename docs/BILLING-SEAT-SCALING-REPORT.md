# Seat-Scaling on Razorpay — Can we auto-bill added users?

> **Date:** 2026-09-30 · **Status:** Report only — no seat-reconcile system to be built yet (client decision).
> **Question:** A client subscribes with 4 users, then adds 3 more a few months later.
> How should the extra 3 seats get billed, and can any Razorpay payment method make that automatic?

---

## 1. The scenario

- Billing is **seat-based**: **₹708 per active user / month** (plan `plan_Ti8Qx1OyPGV2lQ` = 70 800 paisa = ₹600 + 18% GST).
- A "seat" is literally `count(*) from users where status = 'active'` (`apps/api/src/services/billing.ts` → `getActiveUserCount`).
- On subscribe, the subscription's `quantity` is **locked** to the active-user count at that moment (4).

## 2. What happens today (no automation)

When the client later adds 3 users:

- Razorpay **keeps charging for 4**. Nothing changes the recurring amount.
- The app does **not** block the new users and does **not** auto-charge them.
- We only *detect* the gap: `getBillingStatus` returns both `quantity` (4 = billed) and `activeUsers` (7 = reality), so the UI can show "seat drift."
- The only place seats re-sync to reality is **on resume from pause** (`resumeSubscription`).

**Net:** the 3 extra users are effectively used for free until someone intervenes.

## 3. The binding constraint — quantity is frozen on card subscriptions

Razorpay, verbatim (Update a Subscription docs):

> **"For Subscriptions created using domestic cards, you can update only the offer that is linked to them."**

So on a **domestic-card** subscription, `quantity`, `plan`, and `start_at` are **immutable** for the life of the subscription. `PATCH /subscriptions/:id` with a new `quantity` is rejected — this is the exact error we hit in testing. You cannot bump 4 → 7 on the live card subscription.

## 4. Can another payment method make it automatic? (Cards vs UPI vs e-mandate)

| Method | Auto quantity-update? | Mandate ceiling | Notes |
|--------|----------------------|-----------------|-------|
| **Domestic cards** | ❌ **No** — docs-confirmed, only the offer is updatable | Refer Razorpay monetary limits | What the current client is on |
| **UPI Autopay** | ⚠️ **Unconfirmed** | Frictionless ≤ ₹15 000/debit (₹1 L cap; ₹1 L frictionless for BFSI) | Docs list `quantity` as updatable and the *only* stated restriction is the card one — but there is **one conflicting third-party claim** that UPI subscriptions "cannot be updated." Not safe to rely on without Razorpay confirmation. 7 seats ≈ ₹4 956 → comfortably under the ₹15 000 frictionless cap. |
| **e-mandate (eNACH)** | ⚠️ **Unconfirmed** | ≤ ₹1 crore | Highest headroom; but registration is slower (netbanking/debit-card/Aadhaar, some banks take a day) and heavier onboarding. Same doc ambiguity as UPI. |

**Key finding:** The public docs only *affirmatively* state the restriction for cards. They do **not** clearly confirm that quantity-update works for UPI Autopay or e-mandate, and there is conflicting signal. So **we cannot claim any method gives automatic seat-scaling without verifying with Razorpay support.**

## 5. The two Razorpay-compliant ways to charge the extra seats

Regardless of method, these are the only two mechanisms:

### A. Add-ons — `POST /subscriptions/:id/addons`
- Adds an extra amount (₹708 × extra seats) to the **next** invoice; rides the **existing** mandate.
- ✅ Fully automatic, no customer interaction, works on domestic cards.
- ❌ **One-time per invoice** — a cron must re-post the delta **every cycle** while drift persists; if the job misses a cycle we silently undercharge. Total must stay under the mandate's max debit amount.
- **This is the "seat-reconcile system" the client explicitly does NOT want built right now.**

### B. Cancel + recreate at cycle end
- At renewal, cancel the 4-seat subscription, create a fresh 7-seat one.
- ✅ New seat count becomes the **permanent** recurring base — clean, no drift risk.
- ❌ **Cannot be fully automatic** — minting a new card mandate always needs the customer to re-authorize (OTP + a refundable ₹5). New subscription id each time.

## 6. Decisions locked with the client (2026-09-30)

1. Extra seats should bill **from the next cycle** (not mid-cycle proration).
2. Adding users is **allowed freely** — no hard block.
3. **Do NOT build the add-on seat-reconcile system** now.
4. This is **report-only** — decision deferred.

## 7. Recommended safe default (needs no confirmation)

Given "no reconcile system" and "decide later," the safest default that requires **zero new Razorpay risk**:

> **Stay on cards. Keep seats unblocked. Treat a seat increase as a rare, explicit event handled by cancel + recreate, initiated by the admin.**
>
> When the client wants to add paid capacity, they re-subscribe at the new seat count (one OTP + refundable ₹5, once per change — not per month). Until then, the drift indicator in the billing UI shows how many seats are unbilled, so it's visible and intentional rather than silent.

This avoids: the every-cycle add-on cron (fragile), the undocumented UPI/e-mandate path (unverified), and any mid-cycle proration math.

## 8. If you later want true automatic seat-scaling — verify this with Razorpay first

Send Razorpay support this exact question before any build:

> "For a Subscription on plan `plan_Ti8Qx1OyPGV2lQ`:
> 1. If the subscription is authorized via **UPI Autopay**, can I later increase `quantity` (seats) via `PATCH /subscriptions/:id` with `schedule_change_at: cycle_end`, and will the next auto-debit collect the new amount without any customer re-authorization (given the total stays under the frictionless ₹15,000 cap)?
> 2. Same question for a subscription authorized via **e-mandate (eNACH)**.
> 3. For a **domestic-card** subscription, is the *only* supported way to charge for extra seats mid-life the **Add-ons** API (`POST /subscriptions/:id/addons`), and is there any limit on how many cycles I can keep adding add-ons?
> 4. What is the maximum debit amount set on a subscription's mandate by default, and can I raise it at creation to leave headroom for future seat growth?"

- If Razorpay confirms **UPI Autopay allows quantity-update with no re-auth** → that becomes the best path: steer new clients onto UPI Autopay at checkout, and seat increases become a clean, automatic `PATCH ... cycle_end`. **No add-on cron, no re-auth.**
- If they confirm only add-ons work → the reconcile cron is the only automatic option, and the client has already said no to it.

## 9. Sources

- Razorpay — Update a Subscription (domestic-card restriction): https://razorpay.com/docs/payments/subscriptions/update/?preferred-country=IN
- Razorpay — Create a Subscription (`quantity`, `start_at`): https://razorpay.com/docs/api/payments/subscriptions/create-subscription/
- Razorpay — Supported payment methods & mandate ceilings: https://razorpay.com/docs/build/llm-docs/payments/subscriptions/supported-payment-methods.md
- Razorpay — Subscription Add-ons: https://d6xcmfyh68wv8.cloudfront.net/docs/api/payments/subscriptions/

---

### Related change shipped alongside this report (2026-09-30)

User **deletion** was removed everywhere (API endpoint + BFF route + UI action + service fn + tests). Accounts are now **deactivated and reused, never destroyed** — which is also how a seat count *decreases*. See `AGENTS.md`.
