# Go-Live / Handover Checklist

> For onboarding the client and handing over the web app. Do these in order.
> CI/CD was removed, so **deploys are manual**. Migrations `0089`/`0090` are already
> applied to prod Neon (90/90).

## 1. Ship the code (manual deploy) — ✅ DONE (2026-10-01)
- [x] **Pushed** to `origin/main`.
- [x] **API deployed**: `https://sri-aparajita-api.vardhansystems.workers.dev` (cron `*/3` active) — health 200.
- [x] **Web deployed**: `https://sriaparajita.vardhansystems.in` — `/login` 200.
- Re-deploy anytime: `git push`, `pnpm --filter @sri-aparajita/api run deploy`, `pnpm --filter @sri-aparajita/web run deploy`.

> **Razorpay webhook URL (for step 2):**
> `https://sri-aparajita-api.vardhansystems.workers.dev/api/v1/webhooks/razorpay`

## 2. Razorpay — switch to LIVE (CRITICAL — currently on TEST keys)
- [ ] Set prod secrets to **live** values (Cloudflare Worker secrets on `apps/api`):
  - `RAZORPAY_KEY_ID` (live `rzp_live_…`)
  - `RAZORPAY_KEY_SECRET` (live)
  - `RAZORPAY_WEBHOOK_SECRET` (the secret you set on the live webhook below)
  - e.g. `cd apps/api && printf '<value>' | pnpm wrangler secret put RAZORPAY_KEY_ID`
- [ ] In the Razorpay **Live** dashboard → Settings → Webhooks → add a webhook:
  - **URL**: `https://<your-deployed-api-domain>/api/v1/webhooks/razorpay`
  - **Events**: `payment.captured` **and** `order.paid`
  - **Secret**: must equal `RAZORPAY_WEBHOOK_SECRET`
- [ ] (Done) The temporary test-mode cloudflared tunnel + its webhook are stopped/removed.

## 3. Billing config
- [ ] `BILLING_ENFORCED` is **on by default** — ensure the prod secret is **NOT** `"false"`
  (unset = enforced). Set to `"false"` only if you want to postpone enforcement.
  - Gates ONLY the server 402 gate + the full-screen hard-block. The grace "payment due"
    **banner shows regardless** (it's a reminder) — so it appears on localhost too, where
    `.env` sets `BILLING_ENFORCED=false`. (Fixed 2026-10-01.)
- [ ] Billing state is DB-managed: currently **September 2026 = free**, **October = first
  payable** (₹708 × active users). The current month's charge is **auto-created on read**
  (`getBillingAccess`), so the amount + Pay button appear immediately — no longer waiting
  for the `*/3` cron (which never fires under `wrangler dev`, and had a morning gap on
  prod). To grant a free month, set that month's `billing_charges` row `status='free'`
  directly in the DB — see `docs/BILLING-STANDARD-PAYMENT-ARCHITECTURE.md` §11.
- [ ] **Do NOT remove the `*/3` cron.** It runs SE 7 PM tracking auto-stop, collection
  dues, notification/error cleanup, billing reminder emails, AND backstops
  `ensureCurrentCharge` (so the charge + reminders exist even with zero logins).
- ℹ️ Seat scaling is automatic: `syncPendingCharge` (inside `getBillingAccess`) re-prices
  the **pending** month to the live active-seat count on every read; a **paid** month is
  never re-priced (extra seats bill next cycle). Verified live 2026-10-01.

## 4. Receipt — FIXED (issued by Vardhan Systems)
- [x] The payment receipt is now issued **BY Vardhan Systems LLP** (GSTIN `36ABCFV4900D1ZH`,
  Khammam address, PAN, email/phone, SAC 998314, with logo) and **Billed to** the client
  (from Settings → Company). GST split: CGST 9% + SGST 9% (intra-state, both Telangana).
  Vendor details are constants in `apps/web/src/features/billing/receipt-vendor.ts`.
- [ ] Set the client's **real** company name/GSTIN/PAN/address in **Settings → Company** —
  it currently holds placeholders (`36ABCDE1234F1Z5`), which is what shows under "Billed to".
- ℹ️ If you later serve a client **outside Telangana**, the receipt tax must switch to
  **IGST 18%** (the code currently hard-codes intra-state CGST+SGST).

## 5. Data
- [ ] **Products** — the client will add their catalogue (Fuchs + new brands) **from tomorrow**
  via Products → Add. Do **NOT** re-seed the old `0007` catalogue (TITAN etc.) — wrong brands
  for this deployment.
- [x] Users: only the SUPER_ADMIN exists — the client adds their team (Users & Teams).
- [x] Customers / orders / collections / invoices: empty (clean).
- [ ] Set/hand over the client admin's **password** (Users & Teams → Set password), and give
  them the login URL + credentials.

## 6. Secrets & infra (confirm all set on prod)
- [ ] `DATABASE_URL` (Neon prod), Neon Auth vars
- [ ] `RESEND_API_KEY` (billing reminder emails + health monitor)
- [ ] `PHOTOS` R2 bucket binding (task/receipt/expenditure files)
- [ ] Cloudflare API token/account for deploys
- [ ] Any push/maps/other keys the mobile + tracking features use

## 7. Final smoke test (on prod, with live keys)
- [ ] Log in as the client admin; dashboard loads (no billing block — October is free).
- [ ] Add a user, a customer — confirm they save.
- [ ] Optional: make one **real** small payment through Checkout → confirm the webhook marks
  it paid and the receipt renders (then it's genuinely end-to-end on live).

## Notes
- Mobile (Sales Executive) app is a separate track (`MOBILE_PLAN.md`) — not part of this web handover.
- Local dev uses the **prod** Neon DB and (until you switch) live/test Razorpay keys — be careful running scripts locally.
