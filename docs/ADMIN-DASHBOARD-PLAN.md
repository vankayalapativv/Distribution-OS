# Distribution OS — Owner Admin Dashboard (Phase 3) — Approvals + Payments + GST Invoice Upload

> **Status: PLANNING ONLY — no code.** Detail for the owner cockpit described in `SAAS-PLAN.md` §2–3. **v1 scope (updated 2026-11-11), four jobs:** (1) **approve new enterprise signups** — approve + set price, or reject with a reason (the other half of the onboarding flow in [`ONBOARDING-PLAN.md`](ONBOARDING-PLAN.md)); (2) **enterprises list + status**; (3) **handle per-enterprise payments** (price + ledger + manual override); (4) **upload the GST subscription invoices you issue**. **Suspend/activate, impersonation, and cross-enterprise analytics are deferred** (later phases).

## Decisions locked with the owner (2026-11-06)

| Area | Decision |
|------|----------|
| Surface | Separate **`admin.`** subdomain, its own app surface, gated to the platform owner |
| Identity | **Single owner account** (just you), **email + password**, via **Neon Auth with an owner flag** (a super-super-admin, distinct from any enterprise's SUPER_ADMIN). The owner belongs to **no enterprise** |
| Charge cadence | **Auto-generated on the 1st of every month** for all active enterprises — **one common date**, not per-enterprise billing days |
| Pricing | Per enterprise: **per-seat OR flat**. Per-seat = **active-user count × unit price, headcount snapshotted on the 1st**. **A seat = any active user of any role** (SUPER_ADMIN/MANAGER/ACCOUNTANT/SE/LOGISTICS — locked 2026-11-11, matches today's "₹708 per active user"). **Base amount + 18% GST auto-added.** INR |
| GST rate | **Flat 18% for everyone** (per-enterprise rate not needed for v1) |
| Payment | **Razorpay only, paid inside the enterprise's own app** (existing billing flow). Webhook marks the enterprise paid/active. **No manual payment recording.** **No partial payments** |
| Manual override | Owner can **mark an enterprise paid/active without a Razorpay payment** (comp / free month / settled offline) — reason captured, written to the ledger |
| Ledger | **Running per-enterprise history** of charges + payments + overrides |
| GST invoice | You generate the PDF **elsewhere** and **upload it against a specific month's charge**, **typing its metadata**; you run **your own subscription-invoice number series**; the **enterprise downloads it in their app**; **replace-the-file to correct** (no credit notes) |

## Control-plane data model (all global — NO `enterprise_id` column on these; they are keyed BY `enterprise_id` as an FK to `enterprises`)

> Isolation is **locked (2026-11-11): one shared DB + `enterprise_id` + Postgres RLS** (`SAAS-PLAN.md` §1). The cockpit reads/writes **control-plane** tables keyed by `enterprise_id`; it runs as the platform owner (no enterprise membership), so its queries sit **outside** per-enterprise RLS.

- **`enterprises`** — the enterprise record itself: `id`, `name`, `legal_name`, `gstin`, contact, `status` (`pending|active|rejected|suspended`), `created_by` (the signer-upper's user id), `approved_by`, `approved_at`, `rejected_reason`. A signup submit inserts it `status='pending'` with all its config (see `ONBOARDING-PLAN.md`); owner approval flips it to `active`.
- **`enterprise_billing_config`** — `enterprise_id` (pk/fk), `model` (`per_seat|flat`), `unit_amount_paisa` (per-seat), `flat_amount_paisa` (flat), `gst_rate_bp` (default `1800` = 18%), `currency` (`INR`), `updated_by`, `updated_at`. (Already drafted in `SAAS-PLAN.md` §3.) **The owner's Approve action writes the first row here** (the price set at approval), then flips the enterprise to `active`.
- **`billing_charges`** (made per-enterprise) — `id`, `enterprise_id`, `period_month` (e.g. `2026-12-01`), `model` snapshot, `seat_count` snapshot (per-seat only), `base_amount_paisa`, `gst_amount_paisa`, `total_amount_paisa`, `status` (`pending|paid|overridden|void`), `razorpay_order_id`, `generated_at`, `paid_at`, `overridden_by`, `override_reason`, `overridden_at`. **One charge per (enterprise, period_month)** — unique.
- **`billing_payments`** — created from the **Razorpay webhook** (payment truth; no manual entry): `id`, `charge_id` (fk), `enterprise_id`, `razorpay_payment_id`, `amount_paisa`, `paid_at`.
- **`subscription_invoices`** (the GST invoices YOU issue) — `id`, `enterprise_id`, `charge_id` (fk, **one invoice per charge**), `invoice_no` (your own series), `invoice_date`, `taxable_paisa`, `gst_paisa`, `total_paisa`, `their_gstin`, `hsn_sac`, `r2_key`, `uploaded_by`, `uploaded_at`. Replace-to-correct = overwrite `r2_key` + metadata on the same row.
- **`platform_invoice_counter`** (or a row in a settings table) — your company's single running subscription-invoice number series.
- **`platform_owner`** flag — on the Neon-Auth-linked user (an `is_platform_owner` boolean / role), not an enterprise membership.

## Flows

0. **Approve / reject a signup (owner).** A submitted signup lands in the **approval queue** as a `pending` enterprise with all its config visible (company, GST, address, godowns, dues bands, tracking times — everything from the wizard). The owner either:
   - **Approve + set price** — pick `per_seat` or `flat` and the amount, in one step: writes `enterprise_billing_config`, flips `enterprises.status → active`, and **billing starts** (the enterprise's SUPER_ADMIN can now log in and use the app). **The first charge is generated on the next 1st** — an enterprise approved mid-month **rides free until then** (no proration; locked 2026-11-11). OR
   - **Reject + reason** — `enterprises.status → rejected` with `rejected_reason`; the applicant sees the reason, edits their submission, and **resubmits** (back to `pending`). Nothing in the enterprise is usable until approved.
1. **Monthly charge generation (cron, 1st IST).** For every `active` enterprise, insert a `billing_charges` row for the new `period_month`: per-seat → `seat_count` = active-user snapshot × `unit_amount_paisa`; flat → `flat_amount_paisa`. `base + 18% GST = total`. `status = pending`. (Extends today's monthly generator, now per enterprise from `enterprise_billing_config`.)
2. **Enterprise pays (inside their app).** The `pending` charge surfaces in the enterprise app; their SUPER_ADMIN pays via a **Razorpay order**; the **webhook** → charge `paid`, enterprise `active`, insert `billing_payments`. (Reuses `services/billing-v2.ts` + `routes/razorpay-webhook.ts`, scoped per enterprise.)
3. **Manual override (owner).** Owner flips a charge to `overridden`/paid without Razorpay (comp/free/settled offline); captures `override_reason`; appears in the ledger.
4. **Set price (owner).** Owner edits `enterprise_billing_config` (model + amount) per enterprise; applies from the **next** generated charge. See the **Repricing** note below.
5. **Upload GST invoice (owner).** For a given charge/month: upload the PDF + type metadata (invoice no from your series, date, taxable, GST, total, their GSTIN, HSN/SAC). Store in R2 (`subscription-invoices/{enterpriseId}/{chargeId}.pdf`). Enterprise downloads it in their app. Replace-the-file to correct.

## Repricing (raising a price later — e.g. ₹600 → ₹700/user next year)

**Fully supported with no re-subscribe and no customer re-authorization** — because billing is **one-time monthly orders, not a Razorpay subscription/mandate** (`services/billing-v2.ts`: *"No Razorpay mandate/subscription. Each calendar month the app generates a fresh charge."*). The price is just the value used when the next charge is generated.

- **How:** the owner edits `enterprise_billing_config` (`unit_amount_paisa` for per-seat, or `flat_amount_paisa`) in the cockpit. No code change, no deploy. (In the SaaS this replaces the current single-client **hardcoded `UNIT_AMOUNT_PAISA = 70800`** constant, which today would need an edit + redeploy.)
- **When it takes effect:** from the **next generated charge** (the 1st). **Already-generated and already-paid charges are never retouched** — no retroactive repricing. An unpaid current-month charge follows the existing seat-reconcile behaviour: if its amount changes, the stored Razorpay order is **cleared so the next Pay creates a fresh order at the new amount** (the same mechanism a seat-count change already uses).
- **No re-auth:** each month's payment is a fresh manual Razorpay order, so the enterprise simply pays the new amount next cycle. (Were this ever moved to auto-debit **e-mandate**, a raise would instead need to stay under the mandate's max-amount cap or trigger re-authorization — not the case here.)
- **Per-enterprise:** prices are independent per enterprise, so a raise can be applied to one, some, or all enterprises — each from its own next charge.
- **GST clarity:** `enterprise_billing_config` stores the base amount + `gst_rate_bp` (default 1800 = 18%) separately, so decide whether a new "₹700/user" is the **base** (then +18% GST) or the **GST-inclusive** total when setting it. Today ₹708 = ₹600 base + 18%.

## Admin screens (v1)

- **Approval queue** — list of `pending` signups; each row opens the full submitted config (read-only) with **Approve + set price** (model + amount) and **Reject + reason** actions. Empty when nothing is waiting.
- **Enterprises list** — name, status (`pending`/`active`/`rejected`), plan (model + price), **current-month charge status** (pending/paid/overridden), outstanding, last payment date. Filter by status / unpaid.
- **Enterprise detail** — edit billing config (model + price); **charge + payment ledger** (all periods); **invoice panel** per charge (upload / replace / download); **manual-override** action.
- **Deferred (not v1):** suspend/activate, impersonation, cross-enterprise analytics.

## Status & enforcement

The admin **views** status; it does **not** rebuild blocking. Overdue handling (what happens when the 1st passes unpaid → grace → blocked) reuses the **existing per-enterprise billing-guard** in the enterprise app (`billing-guard-v2` + blocked screen, made enterprise-aware). The cockpit just shows the state and offers the manual override.

## Open items (flagged, not v1 blockers)

1. **Place of supply** — owner said "we'll change this accordingly." v1 stores a **single GST amount at 18%**; structure the `subscription_invoices` metadata so a **CGST+SGST (in-state) vs IGST (out-of-state)** split can be added later without a rewrite.
2. **2FA** for the owner login — not decided; recommend TOTP before go-live (one account guarding all enterprises' billing).
3. **Dunning / notifications** — alerting an enterprise that a charge is due, or that a new invoice is available — deferred.
4. **Owner-dashboard staff** — single owner for now; multi-user owner roles is `SAAS-PLAN.md` open decision #2.

## Phasing note

This cockpit is part of **Phase 3** in `SAAS-PLAN.md` — the **merged onboarding + approval + billing phase** (re-sequenced 2026-11-11), because **approval sets the price and starts billing**, so the wizard, the approval queue, and `enterprise_billing_config` ship together. The two halves of one flow: the wizard writes the `pending` enterprise, the cockpit approves it and prices it. Depends on Phase 2 (`enterprises` table + `enterprise_id` + RLS). Isolation is locked (shared DB + RLS), so the control-plane tables can be built now.
