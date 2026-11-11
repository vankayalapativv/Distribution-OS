# Distribution OS — Customer Onboarding (Signup → Wizard → Approval)

> **Status: PLANNING ONLY — no code.** Full detail for the self-serve onboarding described in `SAAS-PLAN.md` §4. Companion to [`ADMIN-DASHBOARD-PLAN.md`](ADMIN-DASHBOARD-PLAN.md) (the owner's approval queue is the second half of this flow). All decisions below were **locked with the owner on 2026-11-11**.

## Vocabulary (so nobody gets confused)

- **Platform owner** = you (Vardhan Systems). Runs the `admin.` cockpit, belongs to **no enterprise**, approves signups and sets prices.
- **Enterprise** = a customer company that buys Distribution OS (the equivalent of "Sri Aparajita" today). The whole app is multi-enterprise; every business row is scoped by `enterprise_id` (shared DB + Postgres RLS — `SAAS-PLAN.md` §1).
- **Enterprise SUPER_ADMIN** = the person who signs up. Their signup creates **their own login**, and — once approved — they are the first SUPER_ADMIN of the enterprise they configured.

## The shape of the flow

```
  Sign up (login only)                Onboarding wizard                 Owner cockpit
  ┌───────────────────┐   verify     ┌────────────────────────┐  submit  ┌──────────────────┐
  │ email + phone +   │ ──email OTP─▶│ multi-step, ALL fields │ ───────▶ │ approval queue   │
  │ password          │              │ mandatory, draft saved │          │                  │
  └───────────────────┘              └────────────────────────┘          │ Approve+set price│──▶ enterprise ACTIVE, billing starts
        creates a user,                 resume on next login               │ Reject + reason  │──▶ applicant edits + resubmits
        NO enterprise yet                                                  └──────────────────┘
```

Nothing in the enterprise is usable until the owner approves. The account can log in, but it only ever sees its own onboarding wizard (draft or pending/rejected status) until then.

---

## Step 1 — Signup (account creation only)

A single public page. It creates a **login**, not an enterprise.

- **Fields:** full name, **email**, **phone**, **password** (+ confirm).
- **Both email and phone are globally unique** across the whole platform (one person = one account; matches the `email or phone + password` login rule in `SAAS-PLAN.md`).
- **Verification = email OTP for v1** (6-digit code via **Resend**, already wired in this codebase). Phone OTP is deferred (open decision #1 in `SAAS-PLAN.md`).
- On verify: the user row exists (verified), **but has no enterprise and no role yet**. They are dropped straight into the onboarding wizard.
- Password reset for phone-only accounts is still an open decision — not needed for v1 since v1 verifies by email.

**What's written:** one `users` row with its `enterprise_id` **not yet set** (the person has no enterprise until they submit the wizard), flagged "onboarding in progress" via an `onboarding_drafts` row. Email/phone are globally unique. The `enterprise_id` is stamped on submit (Step 3). This pre-submit state is the only time a user row has a null `enterprise_id`.

---

## Step 2 — Onboarding wizard (every field mandatory)

A **multi-step wizard**. **Every field is mandatory — nothing optional.** The owner's rule: *"collect all the information during this, mandatory!"* The wizard **auto-saves a draft** after each step (and on blur); if the user leaves and logs back in, they **resume where they left off**. Draft lives server-side keyed to their user id, so it survives device changes.

The steps collect everything an enterprise needs before it can transact. Grouped:

### 2a. Administrator (the person)
- Admin full name (pre-filled from signup, editable), designation/role title.
- (Email + phone already captured at signup; shown read-only.)

### 2b. Company identity
- **Legal company name** (mandatory — today's app treats `legalName` as optional; here it is required).
- **GSTIN** (mandatory — validated format; today it is optional).
- Trade/display name.
- Company contact phone + email (the business line, can differ from the admin's).

### 2c. Registered address
- Address line 1, line 2, city, **state** (place-of-supply source for GST later), **pincode**. All mandatory.

### 2d. Banking + payment
- Bank name, account name, account number, IFSC.
- **UPI ID** (printed on invoices — the current invoice PDF shows a "UPI id:" line).

### 2e. Invoice setup
- **Invoice number series:** prefix + starting number (e.g. `SA/2026-27/` starting `00001`). Drives the generated-invoice counter.
- **Invoice Terms & Conditions:** a text block printed in the invoice footer. **Pre-filled with the current default T&C** (`DEFAULT_TERMS` from `packages/shared/src/invoice-pdf.ts`), **editable** — the enterprise tweaks or replaces it. Stored as their `company_terms` equivalent.

### 2f. Godowns / stock locations
- **At least one godown** (name + address). Stock, GRNs, transfers and invoicing all need a location, so onboarding can't finish with zero. Add-more allowed.

### 2g. Field-tracking auto-stop times
- **Sales-Executive day auto-stop time** and **Logistics run auto-stop time** — **two separate times** (an SE's field day and a delivery run end at different hours). These set the enterprise's tracking cutoff instead of the hard-coded IST end-of-day in the current app.

### 2h. Collection-dues ageing bands (configurable)
- The enterprise defines **its own dues ageing bands** instead of the current hard-coded `0-30 / 31-45 / 46-60 / 61+`.
- **Variable number of bands.** Each band = **from-day → to-day range + a custom label** (the last band is open-ended, e.g. `91+`).
- Bands cover **overdue money only** — a customer appears in a band by **how many days their oldest overdue invoice has been overdue** (see the overdue model below).

> The **dues sweep** (the 9 AM daily job that notifies the SE when a customer crosses **up** into a worse band) is **not** a field the enterprise sets — it's a fixed platform behaviour. It just reads these bands.

### Wizard end
- A **review step** shows everything back. **Submit** is the only way out; there is no "skip".

---

## Step 3 — Submit → `pending`

On Submit, in one transaction (scoped to the new `enterprise_id`):
- Insert the **`enterprises`** row, `status = 'pending'`.
- Insert the enterprise's config from the wizard: company profile / T&C (its `system_settings`), godown(s), invoice series counter, tracking auto-stop times, dues bands.
- Make the signer-upper the enterprise's **first SUPER_ADMIN** (`user_roles` row scoped to this enterprise).
- The draft is cleared.

**Nothing is usable yet.** The SUPER_ADMIN logs in and sees a "pending approval" screen (not the dashboard).

---

## Step 4 — Owner approval (the other half)

Handled in the cockpit — full detail in [`ADMIN-DASHBOARD-PLAN.md`](ADMIN-DASHBOARD-PLAN.md). In short:
- **Approve + set price (one step):** owner picks `per_seat` or `flat` + amount → writes `enterprise_billing_config`, flips `enterprises.status → active`, **billing starts**. The SUPER_ADMIN's next login lands on the real dashboard.
- **Reject + reason:** `status → rejected` with a reason the applicant sees; they **edit their submission and resubmit** (back to `pending`).

---

## The overdue-model change (ripples into existing code)

**Locked decision:** drop the company-wide **`credit_overdue_days` grace**. A customer is **overdue — and credit-blocked — the moment an invoice passes that customer's own `credit_days`** (i.e. `today > due_date`, where `due_date = invoice_date + customer.credit_days`). "Block right at their terms."

> **Scope (locked 2026-11-11): Distribution OS (the SaaS clone) ONLY.** The existing **live Sri Aparajita app is untouched** — it keeps its current 60-day `credit_overdue_days` grace. Do **not** apply this change to the production Sri Aparajita deployment.

This touches three places that currently add the global grace:

1. **Mobile credit gate** — `getCustomerCreditStatus` (`apps/api/src/services/customers.ts`): today it blocks only when `today − due_date > credit_overdue_days` (default 60). **New:** block when `today > due_date` (grace = 0). `creditBlocked = totalOutstanding > 0 && anyInvoicePastDueDate`.
2. **Dues ageing** — the age that places a customer in a band is now **days since the invoice went overdue** (days past `due_date`), bucketed into the **enterprise's configured bands** (2h), not the hard-coded set.
3. **Mobile dues (oldest-bucket rule)** — the SE Home "Collection dues" card and `/dues/me/*` keep the "a customer sits in exactly one bucket" rule, but the bucket boundaries come from the enterprise's bands.

> Clarification captured for the owner: "**days since invoice date**" was the shorthand; precisely, overdue age counts from each invoice's **due date** (`invoice_date + that customer's credit_days`), which is how the current app already computes `due_date`. The only change is removing the extra global grace window.

---

## Data-model sketch (business tables gain `enterprise_id`; these are new)

- **`enterprises`** — defined in `ADMIN-DASHBOARD-PLAN.md` (`id`, `name`, `legal_name`, `gstin`, contact, `status pending|active|rejected|suspended`, `created_by`, `approved_by/at`, `rejected_reason`).
- **`onboarding_drafts`** — `user_id` (pk), `payload` (jsonb of wizard answers), `current_step`, `updated_at`. One per in-progress signup; deleted on submit.
- **`dues_bands`** — `enterprise_id`, `ordinal`, `from_days`, `to_days` (null = open-ended), `label`. Replaces the hard-coded buckets.
- **Per-enterprise settings** (tracking auto-stop SE/Logistics times, invoice series prefix+counter, invoice T&C, company profile) live in the enterprise's **`system_settings`** rows (scoped by `enterprise_id`), mirroring today's single-tenant `system_settings`.
- **`users`** — **one person = one enterprise** (locked 2026-11-11). Email/phone are **globally unique** (login resolves a person platform-wide), **but each user belongs to exactly one enterprise**, so `users` carries `enterprise_id` and is **RLS-scoped like every other table** — no cross-enterprise people leak (important for the MCP: `select * from users` only ever returns the caller's enterprise). Role is the `user_roles` row. The brief window between signup and submitting the wizard is the **only** time a verified user has no enterprise yet (tracked by `onboarding_drafts`, not by a null-enterprise user row); on submit the user is stamped with the new `enterprise_id` as its first SUPER_ADMIN. A person who genuinely works for two enterprises needs **two separate logins** (two emails/phones).

---

## Open items (flagged, not blockers)

1. **Phone OTP / phone-only password reset** — deferred; v1 verifies by email OTP (Resend). (`SAAS-PLAN.md` open decision #1.)
2. **GSTIN validation depth** — format check for v1; live GST-portal verification is later.
3. **Resume-draft expiry** — do abandoned drafts expire? Not decided; harmless to keep.
4. **One person, multiple enterprises** — **decided NO (2026-11-11): one person = one enterprise.** A person who works for two enterprises uses two separate logins. This keeps `users` cleanly RLS-scoped (see the data model). Revisit only if a real multi-enterprise user need appears.
