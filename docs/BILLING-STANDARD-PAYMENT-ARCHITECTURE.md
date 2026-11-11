# Billing v2 — Standard Monthly Seat-Based Payments (Architecture)

> **Date:** 2026-09-30 · **Status:** Proposed architecture — awaiting go-ahead to build.
> **Supersedes:** the Razorpay **Subscriptions** (auto-debit mandate) model.
> **Why the switch:** Subscriptions lock `quantity` on domestic-card mandates, so added
> seats can't reconcile automatically (see `BILLING-SEAT-SCALING-REPORT.md`). Standard
> one-time payments compute the amount **at charge time**, so seats reconcile for free.

---

## 1. Decisions (locked with the owner, 2026-09-30)

| Decision | Choice |
|----------|--------|
| Payment mechanism | **In-app Razorpay Checkout** (Orders API) — a "Pay ₹X" button inside the app |
| Advance vs arrears | **Pay in advance** — pay at the start of a month for that month |
| Cycle anchor | **Calendar month** (1st → last day) |
| Proration | **None** — every month is a full ₹708 × seats charge |
| First month free | **Yes** — free through the end of the **next** calendar month (≥1 full free month) |
| Grace | **7 days** after the month's payment is due, then an **overlay block** |
| Seat basis | ₹708 (incl. 18% GST) × **active users, every role** (`count(*) where status='active'`) |
| Who can pay | **Any web role** — SUPER_ADMIN, MANAGER, ACCOUNTANT (mobile roles never pay) |
| Reminders | **In-app banner/overlay + Email** (Resend). No WhatsApp. |
| GST invoice | **Manual / out of app scope** (2026-09-30 revision) — the owner issues + sends the monthly GST invoice themselves on the 1st. The app tracks amount/seats/paid-status only; it does NOT generate, store, or email invoices |
| Manual/offline payments | **No** — Razorpay Checkout only, no "mark as paid" |
| Billing history | **Yes** — a page listing every month (amount, seats, status, invoice download) |
| Per-seat price | **Hard-coded** ₹708 (₹600 + 18% GST) constant |
| GST supplier data | Read from the **`system_settings` company profile** (legal name, GSTIN, PAN, address); state from GSTIN prefix; SAC + invoice-series prefix are code constants |
| Existing clients | **None** (test phase) → build clean, no migration |

### Free months (2026-10-01 — DB-managed, no app logic)

There is **no "first month free" logic in the app** (the earlier toggle + auto-seeding
and the `/billing/reset` endpoint were removed). Free months are granted **directly in
the DB**: set that month's `billing_charges` row to `status = 'free'` (amount 0). The
access state machine already treats `free` like `paid` for access + `paidThrough`, and
the UI shows a blue "Free month". To start a client fresh, clear the billing tables and
insert the months you want (see §11 for the exact commands).

## 2. The core idea — where seats reconcile

There is **no mandate**. Each month the app **generates a fresh charge** for `₹708 × current active seats`, counted **at generation time** (the 1st of the month). The client pays that exact amount via Checkout. Add 3 users this month → next month's charge is simply computed with the higher seat count. **That generation step _is_ the seat reconcile** — automatic, every cycle, no Razorpay quantity update needed.

## 3. Billing state machine (access)

Access is derived from a single value, **`paidThrough`** = the last day of the latest month that is paid (or free).

```
state:
  free     → within the free period (no charge due)
  active   → current calendar month is PAID; access clean through month end
  grace    → current month unpaid, but now ≤ (month start + 7 days)  → access continues, banner shown
  blocked  → current month unpaid AND now > (month start + 7 days)   → overlay blocks the app

blocked  ⟺  now > paidThrough + 7 days
```

- `paidThrough + 7 days` is the single grace boundary. Pay-in-advance means the next month's
  payment is due on the 1st; the 7-day grace covers days 1–7 of the new month.
- Paying the current month moves `paidThrough` to that month's last day → state returns to `active`.

## 4. Data model

Replace the subscription tables with two small tables (new migration, e.g. `0089_billing_v2.sql`):

```sql
-- One row per monthly charge (the source of truth for what's owed/paid).
create table billing_charges (
  id                uuid primary key default gen_random_uuid(),
  period_start      date not null,             -- 1st of the calendar month
  period_end        date not null,             -- last day of that month
  seats             int  not null,             -- active users counted at generation
  amount_paisa      int  not null,             -- 70800 * seats
  status            text not null default 'pending'
                      check (status in ('free','pending','paid','void')),
  razorpay_order_id text,                       -- Orders API id (null for 'free')
  razorpay_payment_id text,                     -- set when captured
  created_at        timestamptz not null default now(),
  paid_at           timestamptz,
  unique (period_start)                         -- one charge per calendar month
);

-- Idempotent webhook log (mirror of the current subscription_events guard).
create table billing_payment_events (
  event_id   text primary key,                  -- x-razorpay-event-id
  kind       text not null,
  created_at timestamptz not null default now()
);
```

Access (`paidThrough`) is computed as `max(period_end) where status in ('paid','free')` — no separate state column to drift.

## 5. Monthly flow

1. **Cron (existing Workers `scheduled` — every 3 min, self-gated to once/IST-day near month start).**
   On/just before the 1st, if there's no `billing_charges` row for the new month **and** the
   free period has ended:
   - `seats = getActiveUserCount()`, `amount = 70800 * seats`.
   - Create a Razorpay **Order**: `POST /orders { amount, currency:"INR", receipt:"<period>" }`.
   - Insert `billing_charges` row `status='pending'` with the `razorpay_order_id`.
   - (Optionally fire a "payment due" notification — see §8.)
2. **Admin pays in-app.** The billing page / overlay shows **"Pay ₹X for <Month>"**. Clicking it
   opens **Razorpay Checkout** with `key_id` + `order_id`. On success the client handler calls
   our confirm endpoint for instant UX.
3. **Webhook = source of truth.** Razorpay sends `payment.captured` / `order.paid` to
   `/api/v1/webhooks/...` (HMAC-verified, idempotent on event id — reuse the existing infra).
   Handler: mark the matching `billing_charges` row `paid` (+ `razorpay_payment_id`, `paid_at`).
4. **Access recomputes** from `paidThrough`. Overlay/banner update automatically.

## 6. Razorpay pieces

**Used (all standard, no mandates):**
- `POST /orders` — create the monthly order (amount fixed at creation).
- **Razorpay Checkout** (web JS) with `order_id` — the in-app Pay button.
- Server-side **payment signature verification** (WebCrypto HMAC) on the confirm call, plus the
  **webhook** (`payment.captured`, `order.paid`) as the authoritative record.

**Retired from the subscription model:**
- Subscription create / pause / resume / cancel, `start_at` trial, `quantity`,
  `updateSubscriptionQuantity`, seat-drift, `subscription.*` webhook events, `reconcileSubscription`.
- Migrations `0085`/`0086`/`0088` tables (`subscriptions`, `subscription_events`) — dropped or left
  dormant by the new migration. Since there are **no real clients**, the one test subscription can be
  cancelled from the Razorpay dashboard; no data migration is needed.

**Kept / reused:**
- Webhook HMAC verification + idempotency infra (`razorpay-webhook.ts`).
- `billingGate` middleware (402) — repointed at the new `paidThrough`/grace check, still flag-gated by `BILLING_ENFORCED`.
- `BillingGuard` overlay component — rewired to the new state (`free`/`active`/`grace`/`blocked`) with a "Pay ₹X" button for admins.
- The ₹708 unit constant, R2 + Expo push infra (for reminders).

## 7. Overlay & enforcement

- **Server (`billingGate`)**: returns **402** on app routes when `blocked` and `BILLING_ENFORCED==="true"`
  (identity/`/me`/billing/webhook routes stay exempt, as today).
- **Client (`BillingGuard`, re-added to the dashboard layout)**:
  - `grace` → non-blocking amber banner "Payment due — access continues until <date>. Pay now."
  - `blocked` → full-screen overlay with "Pay ₹X for <Month>" (opens Checkout).
- Blocks **all three web roles** when blocked; **any web role** (SUPER_ADMIN / MANAGER / ACCOUNTANT) can pay. Mobile field roles are never billed and never see this.

## 8. Reminders (confirmed)

- **In-app**: amber banner during grace, overlay when blocked (always on).
- **Email** via **Resend** (already used by `health-monitor.ts`, no new provider): one on the **due date** (1st) and one on the **last grace day** (day 7). No WhatsApp.

## 8b. GST invoice (confirmed)

Every paid month produces a **GST tax invoice** from **Vardhan Systems** to the client, **intra-state** so tax splits **9% CGST + 9% SGST** on the ₹600 base (= ₹708 total). It is **auto-emailed** on payment (Resend, PDF attached) **and** kept **downloadable** on the billing page per month.

- Invoice rows carry a sequential invoice number (its own series, e.g. `VS/2026-27/0001`), invoice date = payment date, supplier GSTIN/legal name/address, client legal name + GSTIN (if provided), SAC code for the service, taxable value, CGST, SGST, total.
- **Company data needed from you (below)** to hard-code the supplier block + numbering.
- PDF generated server-side (Workers-compatible, no Node libs) and stored in R2 (like other billing/task files); the row streams back via an authed endpoint.

## 9. Build plan (phased) — progress

- [x] **DB**: migration `0089_billing_v2_standard_payments.sql` (`billing_charges`, `billing_payment_events`). *Written; NOT yet applied to prod.*
- [x] **Service** `billing-v2.ts`: pure `chargeAmountPaisa` / `gstSplit` / `computeAccess`; `ensureGoLive`, `getBillingAccess`, `ensureCurrentCharge`, `ensureOrderForCharge`, `markChargePaidByOrder`, `recordPaymentEventOnce`, `applyPaymentWebhook`, `listCharges`.
- [x] **Razorpay lib**: `createOrder()` + `verifyOrderPaymentSignature()`.
- [x] **Phase 1 — API routes** (`routes/billing-v2.ts`, mounted at `/billing`): `GET /access`, `GET /charges`, `POST /pay`, `POST /confirm`.
- [x] **Phase 2 — Webhook**: `payment.captured` / `order.paid` → v2 (idempotent), falls through to legacy subscription handler for other events.
- [x] **Phase 3 — Cron**: `reconcileSubscription` replaced by `ensureCurrentCharge` (idempotent monthly charge + order).
- [x] **Phase 4 — billing-gate**: 402 gate repointed to `getBillingAccess` (v2). *609 API tests pass.*
- [x] **Phase 5 — Web**: `billing-v2-api.ts` (types + server loader), `use-pay-checkout.ts` (one-time order Checkout), `billing-guard-v2.tsx` (grace banner + block overlay, any web role pays) re-added to `(dashboard)/layout.tsx`, `billing-card-v2.tsx` (status + Pay + month-by-month history) wired into Settings → Billing (server-fetched, no fetch-in-effect). *Web typecheck + lint clean; 1820 web tests pass.*
- [x] **Phase 6 — Reminders** (`billing-reminders.ts`): "due" email on the 1st + "final grace" email on day 7, to active SUPER_ADMIN emails via Resend, once each per month (system_settings markers), pending months only. Wired into the cron. *(GST invoice generation dropped — now manual/out of scope.)* *613 API tests pass.*
- [x] **Phase 7 — Retired** the subscription model: deleted `services/billing.ts`, `routes/billing.ts`, their tests, the old web files (`billing-card.tsx`, `billing-transactions.tsx`, `use-subscribe-checkout.ts`, `billing-guard.tsx`, `billing-api.ts`), the `checkout-return` BFF route, and the subscription functions in `razorpay.ts` (kept `createOrder`/`verifyOrderPaymentSignature`/webhook verify). Migration `0090` **drops** `subscriptions` + `subscription_events`. *API 569 tests, web 1820 tests, typecheck + lint clean.*

### Free months + onboarding are DB-managed (2026-10-01)
- **No free-month logic in the app.** The `billing_free_first_month` toggle, the auto-seeding of free months, the `resetBilling` service and the `POST /billing/reset` endpoint (and its Settings UI) were all **removed**. `ensureGoLive` now only records the go-live date and seeds **no** charges.
- **Grant a free month via the DB**: set that month's `billing_charges` row to `status = 'free'` (amount 0). `free` counts toward access + `paidThrough` exactly like `paid`; the UI shows a blue "Free month".
- **Monthly charges** are still created automatically by the cron (`ensureCurrentCharge`, PENDING, at the live seat count) on the 1st. Orders are created **lazily** on the Pay click (`ensureOrderForCharge`), so the cron makes no Razorpay calls.
- **Reset/onboarding** is a DB operation (clear the billing tables + set go-live + insert the months you want). See §11.

> **GST invoices are manual (2026-09-30):** the app does not generate/email invoices; the owner issues them each month. The `gstSplit`/SAC/invoice columns were removed from the design + migration.

## 11. DB commands — managing a client's billing

All against the (Neon) billing tables. **Reset a client to a clean start** (e.g. October free, first charge November):

```sql
-- wipe billing state
delete from billing_charges;
delete from billing_payment_events;
delete from system_settings where key = 'billing_go_live_date' or key like 'billing_reminded_%';

-- pin the go-live date so ensureGoLive doesn't re-stamp it
insert into system_settings (key, value) values ('billing_go_live_date', '2026-10-01')
  on conflict (key) do update set value = excluded.value;

-- make the current month FREE (₹0). The next month is auto-created (pending) by the cron on the 1st.
insert into billing_charges (period_start, period_end, seats, amount_paisa, status)
values ('2026-10-01', '2026-10-31', 0, 0, 'free');
```

**Mark any single month as free** (e.g. a goodwill/free month) — set the whole month range and zero the amount:

```sql
-- FREE a month that already has a row (created by the cron):
update billing_charges
   set status = 'free', amount_paisa = 0, seats = 0, razorpay_order_id = null
 where period_start = '2026-11-01';   -- 1st of the month to make free

-- or INSERT a free month that doesn't exist yet (use the 1st and last day of that month):
insert into billing_charges (period_start, period_end, seats, amount_paisa, status)
values ('2026-11-01', '2026-11-30', 0, 0, 'free')
  on conflict (period_start) do update
    set status = 'free', amount_paisa = 0, seats = 0, razorpay_order_id = null;
```

`period_start` is always the **1st** of the month and `period_end` the **last day**. Only touch `pending`/absent months — a `paid` month is settled and should stay as-is.

> **Note:** v2 routes/gate query `billing_charges`, so they error until migration `0089` is applied to the (prod) Neon DB. With `BILLING_ENFORCED=false` and the overlay removed, the app runs fine meanwhile; enable enforcement only after the migration is applied and the web is wired (phase 5).

**No new secrets** — same `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET`.
**Razorpay dashboard action (you):** enable the `payment.captured` (and `order.paid`) webhook events
for our endpoint; cancel the leftover test subscription.

## 10. Trade-off to accept

Standard payments mean **no auto-debit** — the admin must actively pay each month (a click on the
in-app button). That's the deliberate trade for **automatic seat reconciliation** and zero mandate
limits. The 7-day grace + overlay is what enforces payment.

---

### Build approved (2026-09-30)
Owner approved the build. GST supplier data is read from the **Settings → company profile**
(`system_settings`: `company_legal_name`, `company_gstin`, `company_pan`, `company_address`,
`company_trade_name`). Supplier **state** is derived from the GSTIN prefix (36 = Telangana → intra-state).
**SAC code** default `998314` and **invoice-series** prefix are code constants (change via deploy).
The client's own GSTIN is included on the invoice when present on their customer/org record (B2B),
else a plain receipt.

**Sequencing note (local dev = live prod):** the migration touches the PROD Neon DB and Razorpay
uses LIVE keys. New tables are additive and safe; **dropping** the old subscription tables is deferred
until v2 is verified. Order creation is a no-charge intent; no real payment is triggered during dev.
