# Full Code + Security Review — `apps/web` & `apps/api` — 2026-11-10

**Scope:** every source, test, and config file under `apps/web` and `apps/api` (~1,400 files), reviewed exhaustively through two lenses — **correctness** and **security** — by 18 parallel reviewers (6 API partitions, 12 web partitions). **Report-only: no code was changed.** Mobile, MCP, and `packages/*` were out of scope per request.

## Headline

- **0 High-severity findings.** No SQL injection, no exploitable auth bypass, no secret leakage, no SSRF, no unsafe deserialization anywhere in scope.
- **16 Medium findings** (3 security / defense-in-depth, 13 correctness). None are remotely exploitable today; several are financial-accuracy or billing-robustness issues worth fixing.
- Many **Low** findings (UX, display, timezone, atomicity-of-non-financial-writes, client-side validation gaps backed by server checks).
- **The security posture is genuinely strong:** JWT verification pins EdDSA/Ed25519 (no alg/key confusion), CORS is a static allow-list with bearer auth (no credentialed cross-origin), the Razorpay webhook does constant-time HMAC over the raw body before any parse, all SQL is parameterized, and the error handler leaks nothing. The reviewers repeatedly called the auth/db/money core "unusually solid."

> Context: this is a **single-client** deployment where the three office roles are fully trusted and SEs are the only partially-trusted actor. Many "missing per-record scoping" patterns are acceptable here and are noted as such, not flagged.

---

## Priority fixes (the 16 Medium findings, ranked)

### Security / access-control (3)

| # | Location | Issue | Why it matters | Verified |
|---|----------|-------|----------------|----------|
| S1 | `apps/api/src/middleware/auth.ts:71-82` | Profile query `… order by u.created_at desc limit 1` collapses a **multi-role** user to one arbitrary role (`user_roles` is many-to-many). | The whole authz stack (`requireRole`/`requireCapability`) then trusts a nondeterministic role → silent under/over-grant, cached 10s. Safe only while every user has exactly one role **today**; a latent landmine the moment a second role is assigned. | — |
| S2 | `apps/web/src/app/(dashboard)/{orders,collections,customers}/[id]/page.tsx:16-23` | Detail pages gate on coarse web-role membership, **not** `canAccessSection()` like their list pages. | A SUPER_ADMIN who revokes a MANAGER/ACCOUNTANT's `section:collections` permission → the **list** redirects but `/collections/<id>` still renders. API data-scoping is the backstop, so it's an incomplete enforcement of the permission toggle, not raw data leak. | ✅ confirmed |
| S3 | `apps/web/src/app/api/admin/set-password/route.ts:30-42` and `.../admin/sessions/route.ts` | The two highest-privilege BFF routes (reset **any** password; list/revoke **any** sessions) authorize **only** by "`sa_session` cookie present" + the Neon admin plugin — no explicit SUPER_ADMIN **app-role** check, and no call to the role-checked `/super-admin/users` API (unlike create/update-user). | All three web roles get an `sa_session` at login, so "session present" doesn't distinguish SUPER_ADMIN. **Not exploitable today** (only SUPER_ADMIN holds the Neon admin role), but a one-config-change-away defense-in-depth gap in the most sensitive routes. | ✅ confirmed |

### Correctness — financial / billing (highest impact)

| # | Location | Issue | Scenario | Verified |
|---|----------|-------|----------|----------|
| C1 | `apps/api/src/services/billing-v2.ts:446-455` | `applyPaymentWebhook` commits the idempotency event id (`recordPaymentEventOnce`) **before**, and separately from, `markChargePaidByOrder` — two auto-committed statements, not one transaction. | If the isolate dies between them, Razorpay redelivers → `fresh=false` → handler returns `paid:false` and the charge is **never** marked paid. **A paying client stays blocked.** (The deferred reconcile cron would be the backstop.) Fix: wrap both in one `sql.transaction([...])`. | ✅ confirmed |
| C2 | `apps/web/src/features/invoices/invoice-generate-api.ts:199` | `orderToInvoiceSeed`: `cap = remaining != null && remaining > 0 ? remaining : it.quantityUnits`. A **fully-invoiced** order line has `remaining === 0`, so the `> 0` falls through to the **full original ordered qty** — the `>0` filter doesn't drop it, and the inflated cap also defeats the client over-bill guard. | "Create Invoice" on an already-fully-invoiced order pre-fills each line at full qty with no warning → a **second full invoice** can be generated, re-deducting stock and re-billing, unless the server's independent remaining-check rejects it. Fix: `remaining != null ? remaining : it.quantityUnits`. | — |
| C3 | `apps/api/src/services/invoicing.ts` `cancelInvoice` | Unlike `generateInvoice`/`editGeneratedInvoice`, cancel **never calls `recomputeCustomerBalances`**, and has **no `amount_collected > 0` guard**. | Cancelling a generated invoice for a customer with advance credit/other open invoices leaves the customer-level balance stale; cancelling one that already had a verified collection strands its `collection_allocations` pointing at a zeroed/cancelled invoice. (This is pre-existing — not introduced by the recent backing-order change.) | partial (I own this file; omission confirmed in earlier read) |
| C4 | `apps/api/src/services/profit.ts:73-78` | `profitReport` filters only `invoice_source='generated'`, **no `doc_status <> 'cancelled'`** — and cancel keeps `invoice_items`. | Cancelled generated invoices still add taxable/COGS to every profitability rollup. `reports.ts` billed queries **do** exclude cancelled → internal inconsistency. | — |
| C5 | `apps/api/src/services/sku-analytics.ts:107-124,158-169` | `getSkuAnalytics` filters `line_items` by **date only** — no `doc_status`/`approval_status` exclusion. | Cancelled/rejected invoices inflate the "Billed (from invoices)" SKU breakdown, brand/segment rollups, and 6-month trend — disagreeing with the `reports.ts` headline that excludes cancelled. | — |
| C6 | `apps/api/src/services/dashboard.ts:137` | `getAccountantDashboard` counts `accountant_approval_status = 'approved'`, but collections only ever carry `pending \| verified \| rejected`. | The dashboard's **`approvedCollections` metric is always 0**, no matter how many are verified. | — |

### Correctness — platform / data

| # | Location | Issue | Scenario |
|---|----------|-------|----------|
| C7 | `apps/api/src/services/tracking-distance.ts:223-233` | `recalculateTrackingSessionDistance` issues one awaited `UPDATE gps_points` **per point** in a loop, on **every** insert batch. | The exact per-row Workers-subrequest antipattern the repo bans (audit G-0401). A long field day (hundreds of points) re-updates all N points one round-trip at a time → subrequest-cap/latency risk. Fix: one set-based `update … from unnest(...)`. |
| C8 | `apps/web/src/features/orders/order-oil-line-row.tsx:106` + `order-draft-submit.ts:8-14` | A new oil line with **qty 0 or negative** passes client validation (`collectDraftItems` never checks `quantityUnits > 0`; `validateDraft` only range-checks *locked* lines). | A 0/negative-unit order line is submitted if the API doesn't reject it. Add a `quantityUnits >= 1` guard. |
| C9 | `apps/web/src/features/tasks/tasks-shared.ts:71` | `isOverdue` does `new Date(dueDate + "T23:59:59") < new Date()` — **no timezone** → parsed UTC on the server, IST in the browser. | React **hydration mismatch** on the Due cell + a ~5.5h-lenient overdue boundary for tasks rendered 00:00–05:29 IST. Anchor to `+05:30`. |
| C10 | `apps/web/src/features/expenditures/use-expenditure-form.ts:73-83` | When the entry POST succeeds but the bill upload fails, it throws **before** `invalidateQueries`. | The expenditure is created server-side but invisible in the list/summary until an unrelated refetch — inviting a duplicate re-entry (clientUuid prevents the dupe, but the user gets no signal). |
| C11 | `apps/web/src/lib/format.ts` `litres()` on stock read surfaces | `litres(n) = n.toFixed(1)` → a **sub-litre pack** (e.g. 0.037 L) renders "0.0 L", 0.25 L → "0.3 L", 0 → "—". | All stock balance/lookup/near-expiry/doc-detail surfaces mis-render sub-litre packs. (Catalogue renders raw `packSize` correctly — only stock read surfaces round.) |
| C12 | same stock read surfaces | They use `litres(pack)+" L"` instead of `packLabel(pack, unit)`. | A **piece-sold** product (sentinel pack = 1, unit "quantity") shows "**1 L**" instead of "**pcs**". Entry grids/SkuPicker use `packLabel` correctly. (Matches the known `stock-quantity-products` gap.) |
| C13 | `apps/web/src/features/stock/stock-import-dialog.tsx:59-63,84` vs `stock-import.ts:143-145` | The import dialog copy says **"Rate is optional"**, but `validate()` returns "Rate is required." for any blank-rate row. | Every row the user leaves rate-blank (following the on-screen instruction) is silently marked Error and excluded from "Load N rows". The dialog copy is wrong — rate is mandatory. |

---

## Low findings (condensed, by area)

**API**
- `routes/errors.ts` pagination passes `NaN` for `?page=abc`; `expenditures.ts` (and the general pattern) cast a raw `:id` to `::uuid` without a UUID guard → malformed id yields a 500 instead of 404 (only `errors.ts` guards).
- `lib/neon-auth.ts` — token `iss`/`aud` not checked (defense-in-depth; not exploitable with the single-project JWKS); `findKey` picks the first OKP key when `kid` is absent and never asserts `crv === Ed25519`.
- `orders.ts` partial-delivered `updateOrder`: an existing un-invoiced line passed back with `orderItemId` is updated then deleted (safe only because the UI sends `orderItemId` for billed lines only).
- `market-intelligence.ts`, `products.ts` (`updateProduct`), `stock-locations.ts`, `tracking-dwell.ts` — non-atomic multi-writes / N+1 insert loops (all non-financial; products/stock-locations self-correct on next save).
- `invoicing.ts` cancel try/catch is a no-op (dead code).
- `dashboard-metrics.ts` / `dashboard-analytics.ts` — `credit_note` collections counted inconsistently between an agent card and its drill-down.
- `billing-reminders.ts` — the once-per-month marker is set before the email send succeeds → a transient Resend failure permanently suppresses that month's due/grace email.
- **Verify:** `collections.ts` `listCollections`/`listCollectionsPaged` take an unused `_context` and rely on the **route** to pass `collectedBy` to scope an SE — if any SE route omits it, an SE could list all collections. `getCollectionById` *is* correctly scoped. (The route-layer reviewer judged the collections routes clean; cross-check the SE list path.)

**Web**
- Section nav filter and the live-lapse billing overlay both "fail open" on the client (cosmetic; the server 402 gate is the real boundary).
- Sales-return / credit-note / incentive / target forms: client validation doesn't cap per-line return qty / credit amount / percentages to their server limits (server is authoritative; late 422 instead of inline guidance).
- Several **timezone** nits where a default date range or picker uses the browser/UTC clock instead of the IST helper (dashboard "Today", expenditures default range, market-note default date) — near-zero impact for a single Hyderabad client.
- Blob object URLs not revoked (ledger, MI media); skeleton flashes on refetch in a couple of hooks; a few debounce `useEffect`s depend on a freshly-recreated `url` object.
- `products-api.ts:27` hardcodes `http://localhost:8787` as the base-URL fallback → product client calls hit localhost if `DISTRIBUTION_OS_API_BASE_URL` is unset in prod.
- Minor: a react key `brand:${b.brand}` can collide for same-name brands; "undefined items" renders if the API omits `oilLines`; order export truncates to page 1 if `total` is ever omitted; `isLive` depends on the client clock.

---

## Clean / strengths (verified by the reviewers, not findings)

- **Auth core:** EdDSA/Ed25519-pinned JWT verification (no alg/key confusion), exp/nbf/sub checked; CORS static allow-list + bearer (no credentialed cross-origin); error handler leaks nothing; billing-gate path matching is prefix-safe (no `/healthx` bypass).
- **Money:** invoicing GST split (`round2` CGST/SGST, IGST), gap-free invoice-series allocation with guarded rollback, FEFO lot draw-down + non-negative CHECK backstop, the new backing-order batch ordering (FKs satisfied), COGS null-propagation, reconcile/opening-balance integer-paise allocation — all correct and atomic.
- **Injection:** every query is a parameterized tagged-template or `sql.query` with positional params; dynamic WHEREs interpolate only `$n` placeholders and whitelisted columns. Razorpay HMAC is constant-time over the raw body.
- **Web:** all server fetchers attach auth headers and never trust client-supplied ids for authz; no `dangerouslySetInnerHTML` with user data (map popups are `escapeHtml`'d); no token/secret reaches the client beyond the by-design bearer; config has no hardcoded secrets (only public PostHog/base-URL tokens), `compatibility_date` current with `nodejs_compat`.
- Attendance derivation, dues bucketing, fulfillment ladder, FEFO batch-pick UI, customer ledger Dr/Cr balancing — all reviewed and correct.

---

## Suggested order of work

1. **C1** (billing settlement atomicity) and **C2** (order→invoice over-bill) — the only two with direct money impact.
2. **S1 / S2 / S3** — close the access-control gaps before they become reachable (e.g. before any multi-role user or a second owner-dashboard operator exists). Especially relevant given the SaaS/enterprise direction.
3. **C3–C6** (cancelled-invoice exclusions + cancel recompute + the always-zero metric) — financial-reporting accuracy.
4. **C7** (tracking N+1) — before field usage scales.
5. The rest (C8–C13 + Lows) as cleanup.

*Report-only — nothing was changed. Tell me which findings you'd like me to fix.*
