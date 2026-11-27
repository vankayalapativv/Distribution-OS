# Field Expense Claims, Advances & Payroll-lite — Implementation Plan

> **Status:** Planned — **deferred / future version**. Captured from a discovery discussion on 2026-11-28.
> No code written. This doc is the agreed scope + a staged roadmap, verified against the live
> `expenditures` schema (`0001_init.sql`) and the real permission catalog (`apps/api/src/services/permissions.ts`).

## 1. What we're building

Three capabilities, all layered onto the **existing Expenditure feature** (web-only today, roles SUPER_ADMIN / MANAGER / ACCOUNTANT, 18 categories, R2 bill upload, no approval step):

1. **Expense reimbursement claims** — SE/Logistics submit expenses from mobile; an office role approves; approved claims become company expenditures **and** a payable the company owes the employee.
2. **Advances** — cash given to a person ahead of salary (SE can request on mobile, or office records directly), recovered from their salary.
3. **Payroll-lite** — a monthly salary per person and a "pay salary" action that nets advance recovery, so the system can show net pay (e.g. ₹20K − ₹10K advance = ₹10K).

**Hard constraint:** everything stays per-enterprise via Postgres RLS (every new table gets `enterprise_id` + `ENABLE ROW LEVEL SECURITY` + the `enterprise_isolation` policy + explicit `GRANT … TO app_tenant`, per the `0001` pattern; `getSqlClient(c)` auto-scopes).

### Decisions captured (owner-confirmed 2026-11-28)

| Topic | Decision |
|---|---|
| Money model | A claim is a **reimbursement** — employee spent their own money; approved → company owes them |
| Integration | **Extend the existing Expenditure feature** (same ledger/categories/page), add a claims sub-page |
| Submission | SE/Logistics submit from **mobile, online-only** (no offline queue) |
| Receipt | **Always required** — a bill photo on every claim (reuse R2 `expenditures/{id}/…`) |
| Categories | **Reuse existing field categories** (the person-linked `variable` ones); office-only categories stay web-only |
| Approval | **One step, any _permitted_ office role**; **partial approval** (reduced amount + reason) allowed |
| Rejection | Back to SE, **editable → resubmit** |
| Reversal | **Void/reverse** allowed (expenditure + ledger adjust, with audit trail) |
| Advance = | A **receivable**, NOT an expense (only the approved reimbursement / the gross salary are expenses) |
| Advance init | **Both** — SE requests on mobile (office approves + disburses) *or* office records directly |
| Recovery schedule | **Chosen per advance** — full next salary, or installments |
| Over-advance | Recover what fits (net pay → ₹0), **carry the remainder forward** (arrears-style) |
| Tracks | Advances recover **from salary only**; reimbursements are a **separate** payable paid on their own |
| Salary scope | Store a **monthly salary per person, for all staff**; always monthly |
| Salary booking | **Gross** salary is the expense (₹20K → Salaries category); the advance was cash-out when given |
| Salary run | **Per person, when ready** (not a batch run) |
| Mobile self-service | SE/Logistics see own **salary + net pay + advance balance + claim history/status** |
| Salary privacy | **Others' salaries = Super-Admin-only by default**; everyone sees their own |
| Permissions | Per-action, Manager & Accountant independently, via `/permissions`; ship **all ON (opt-out)** |

## 2. The two money tracks (keep them mentally separate)

```
TRACK A — Reimbursements (company owes employee)         TRACK B — Salary & advances (employee owes company, then salary)
  SE submits claim (mobile, receipt) ─► approval queue     Office/​SE → advance given/approved  ─► advance receivable ↑
     approve (full or reduced) ─► books expenditure            monthly "pay salary" (per person):
       + payable to employee ↑                                   net = salary − recovery_this_month
     mark paid/settle ─► payable ↓ (cash/UPI/bank)               books GROSS salary expense (Salaries category)
     reject ─► editable ─► resubmit                              advance receivable ↓ (carry remainder if > salary)
```

The two tracks do **not** net against each other (owner decision). A person can simultaneously be owed reimbursements and owe an advance.

## 3. Data model

> Verify column names against the live schema before writing DDL; the `0001` re-baseline means prose migration numbers elsewhere are unreliable.

**Extend `public.expenditures`** (today: `expenditure_code, expenditure_date, category_id, amount, payment_mode, paid_to, user_id, remarks, bill_file_key, bill_content_type, created_by, client_uuid` + `enterprise_id`). Add:
- `status text` — `submitted | approved | rejected` (office-created rows are born `approved`).
- `source text` — `office | field` (field = mobile claim).
- `submitted_by uuid` — the SE/Logistics claimant (distinct from `created_by`).
- `claimed_amount numeric(14,2)` — original; `amount` stays the **approved** (possibly reduced) figure that books.
- `approved_by uuid`, `approved_at timestamptz`, `reject_reason text`.
- `reversed_at timestamptz`, `reversed_by uuid` (void/reverse).
- Receipt required when `source='field'` → enforce `bill_file_key is not null` for field claims.
- `paid_at` / settlement is tracked on the payable ledger (below), not here — "approved" ≠ "paid".

**New `public.reimbursement_payables`** (Track A settlement) — one per approved claim: `expenditure_id`, `user_id`, `amount`, `status` (`owed | paid | reversed`), `paid_at`, `paid_by`, `payment_mode`. The person's "company owes you" balance = sum of `owed`.

**New `public.staff_salaries`** (effective-dated, so raises keep history): `user_id`, `monthly_amount numeric(14,2)`, `effective_from date`, `created_by`, `created_at`. Current salary = latest `effective_from <= today`.

**New `public.advances`**: `user_id`, `amount`, `source` (`request | direct`), `status` (`requested | approved | active | cleared | rejected`), `recovery_plan` (`full_next | installment`), `installment_amount numeric(14,2)` (nullable), `outstanding numeric(14,2)`, `requested_by`, `approved_by`, `approved_at`, `remarks`. An SE request starts `requested`; office approval → `active`.

**New `public.salary_payments`**: `user_id`, `period_month date`, `gross_amount`, `advance_recovered`, `net_paid`, `payment_mode`, `paid_by`, `paid_at`. Recording one: (a) inserts an expenditure in the **Salaries** category for `gross_amount`; (b) reduces matching `advances.outstanding` by `advance_recovered` (carry remainder forward if an advance exceeds the month's salary). One per user per month (unique `(user_id, period_month)`).

Idempotency: field submissions and the salary-run action should carry a `client_uuid` for safe retries (mirrors orders/collections/visits), even though submission is online-only.

**Money math in SQL `numeric`, never JS float** (repo rule) — all balances/recoveries computed in Postgres.

## 4. Lifecycle / state machines

**Claim:** `submitted → approved(amount≤claimed) → (payable) paid` · `submitted → rejected → (SE edits) → submitted` · `approved → reversed`.
**Advance:** `requested → approved/active → (recovered over 1..n salary runs) → cleared` · `requested → rejected`. Direct office advance starts at `active`.
**Salary:** per person per month: compute `recovery_this_month` from active advances' plans → `net = gross − recovery` (floored at 0; unrecovered amount stays `outstanding`).

## 5. Permissions (`/permissions`)

Real model (`apps/api/src/services/permissions.ts`): `CONFIGURABLE_ROLES = ["MANAGER","ACCOUNTANT"]`; there is already `section:expenditures` ("Expenditure") and `action:expenditures.manage` ("Manage expenditures"). SUPER_ADMIN is never configurable (always full). Defaults are `d(MANAGER, ACCOUNTANT)`.

**Add these actions under the existing Expenditure section** (all ship ON for both → `d(T,T)`, i.e. opt-out):
- `action:expenditures.claims.approve` — approve / reject / partially approve claims
- `action:expenditures.reimbursements.pay` — mark a reimbursement paid / settle
- `action:expenditures.advances.manage` — give / record a direct advance
- `action:expenditures.advances.approve` — approve an SE advance request
- `action:expenditures.salary.pay` — record a monthly salary payment
- `action:expenditures.void` — void / reverse an approved or paid entry
- (keep `action:expenditures.manage` for edit/delete + view balances/ledger)

**Separate, more-sensitive salary permissions** (ship **OFF** for both → `d(F,F)`, SA-only until granted):
- `action:salary.view` — see **others'** salary figures (everyone always sees their own)
- `action:salary.manage` — set / change a person's salary

**Enforcement:** two layers as today — `useCan` in the web UI and `sectionGuard` / an action guard server-side. **Permissions govern approval**: the set of eligible approvers = SUPER_ADMIN + roles still holding `expenditures.claims.approve`. SE/Logistics core abilities (submit a claim, request an advance, view own salary/balance) are **always on**, never gated.

⚠️ **Cross-section guard (known trap):** approving a claim / running salary reads across areas (the person, their advance balance, the category, R2 bill). The action guards must **GET-exempt those read lookups**, or they re-trigger the cross-section-dependency 500 you fixed before (same shape as the accountant invoice→godown block). Design it in.

## 6. Clients

- **Mobile (Expo, online-only):** SE/Logistics get — submit a claim (category, amount, mandatory receipt photo) + claim history/status; request an advance; a "My pay" view (salary, net pay, advance outstanding). Receipt upload is a normal online R2 POST (no offline queue). Reuse Expo push for status changes.
- **Web (office):** inside the **Expenditure page**, a new **Claims sub-page** (approval queue: approve / reduce+approve / reject), the existing unified expenditure ledger, per-person **balances** (reimbursement owed + advance outstanding), **advance** entry/approval, and the per-person **"Pay salary"** action. Salary figures hidden unless `salary.view`.

## 7. Notifications

Reuse Expo push + `se_notifications`: office ← new claim / new advance request; SE ← claim approved/rejected/paid, advance approved, salary paid. (Push currently targets SALES_EXECUTIVE; office notifications may use the web/in-app feed.)

## 8. Suggested phase order (each independently useful)

1. **Claims MVP** — mobile submit (receipt required, online) + web Claims sub-page approval writing into the existing `expenditures` ledger (partial approval, reject→resubmit). Permission actions added.
2. **Reimbursement payable** — the "company owes employee" balance + mark-paid; per-person reimbursement view (web + mobile).
3. **Advances** — SE request + office approve/record, recovery plans, outstanding balance.
4. **Payroll-lite salary** — `staff_salaries` + per-person "Pay salary" (gross expense, advance recovery, carry-forward) + salary permissions + "My pay" on mobile.
5. **Void/reverse + polish** — reversals with audit, exports/statements, cross-checks.

## 9. Minor defaults (flagged, change anytime)

- Installments defined as **₹/month until cleared** (not a fixed term).
- Salary stored **effective-dated**; the current effective salary is used for the month.
- "Mark paid" optionally records **method** (cash/UPI/bank).
- SUPER_ADMIN **has a salary record too** (all staff), but using it is optional.
- A monthly salary payment is **unique per person per month**; re-running corrects via void, not duplicate.

## 10. Open questions for build time

- Exact placement of the per-person **statement/export** (hand to the employee / Tally) — a Phase 5 nice-to-have.
- Whether an **advance request** needs a receipt/justification note (currently: no).
- Reconciling **gross-salary-as-expense** with how the owner reads the Salaries total today (it may currently hold net cash) — confirm the reporting expectation before Phase 4.
