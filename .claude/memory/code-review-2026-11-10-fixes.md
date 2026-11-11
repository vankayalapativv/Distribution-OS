---
name: code-review-2026-11-10-fixes
description: "Exhaustive code+security review of apps/web + apps/api (2026-11-10, ~1400 files, 18 parallel reviewers) → 0 High / 16 Med / many Low; ALL Medium + security + actionable Lows + C11/C12 FIXED and DEPLOYED 2026-11-10. Report at docs/CODE-REVIEW-2026-11-10.md."
metadata:
  node_type: memory
  type: project
  originSessionId: 87018263-5262-4535-aa57-65bc1d4b7245
  modified: 2026-11-10T11:38:46.977Z
---

**Full code + security review of `apps/web` + `apps/api`** (2026-11-10). Scope: every source/test/config file (~1,400) reviewed exhaustively through correctness + security lenses by **18 parallel subagents** (6 API partitions, 12 web). Written report: **`docs/CODE-REVIEW-2026-11-10.md`** (committed). Outcome: **0 High, 16 Medium, many Low. No exploitable security holes** — JWT is EdDSA/Ed25519-pinned, CORS static+bearer, Razorpay HMAC constant-time over raw body, all SQL parameterized.

**All Medium + security + the actionable Low findings + C11/C12 FIXED, tested (API 1321 / web 1670 green), and DEPLOYED to prod 2026-11-10** (API version `fb0f8530`, web `e68b2604`). Commits (all on `main`, pushed): `eaf47d9` (Med+security), `95980fb` (Lows), `854a907` (C11/C12). No migration needed — code only.

**Key fixes:**
- **billing-v2 `applyPaymentWebhook`**: idempotency-event insert + charge paid-flip now in ONE `sql.transaction` (was two auto-committed stmts → a crash between them could leave a paying client blocked; Razorpay redelivery was deduped). The flip is idempotent, so it self-heals a legacy stuck charge.
- **invoicing `cancelInvoice`**: blocks cancel when `amount_collected>0` (was stranding collection_allocations) + calls `recomputeCustomerBalances` (parity with generate/edit); removed a dead catch.
- **invoice-generate seed** (`orderToInvoiceSeed`): `remaining != null ? remaining : qty` so a FULLY-invoiced order line isn't pre-filled at full qty (was allowing a duplicate invoice unless the server remaining-check rejected).
- **profit.ts + sku-analytics.ts**: exclude `doc_status='cancelled'` (match the reports headline).
- **dashboard.ts**: accountant metric counts `'verified'` (was `'approved'`, a non-existent collections status → always 0).
- **tracking-distance + tracking-dwell**: per-row N+1 UPDATE/INSERT loops → one set-based `unnest` statement (audit G-0401 Workers subrequest antipattern).
- **Security**: `middleware/auth.ts` resolves a multi-role user DETERMINISTICALLY by highest privilege (was an arbitrary `created_at` tiebreak; full capability-UNION is a separate design choice, NOT done). Web `orders/collections/customers/[id]` detail pages now use `requireSectionAccess` (revoked section blocks detail, not just list). Admin `set-password`/`sessions` BFF routes add an explicit SUPER_ADMIN app-role check (`getSessionRole`), not just `sa_session` presence. `neon-auth` key pick pinned to `crv=Ed25519`.
- **Correctness/UX**: qty-0/negative order lines dropped; `tasks.isOverdue` + all date-field defaults (returns/opening-balance/invoice/credit-note/collection/expenditure/market-note) + dashboard `presetRange` anchored to **IST** (no UTC "yesterday" before 05:30); market-note create/update now one transaction + bulk insert; products `updateProduct` + stock-locations default-flag made transactional; billing-reminders marker released on send failure; plus guards (null-km, NaN page/reorder, delete error feedback, dashboard brand-key collision, encoded order deep-link, stable list-debounce deps, incentive/target numeric clamps, MI price/date/media-catch).
- **C11/C12 (stock display)**: threaded product `unit` through the stock read queries (balances, near-expiry, lookup, GRN/transfer/adjustment detail, invoice-lot lines) + mappers + web row types, and switched read surfaces to `packLabel(pack, unit)`. Piece-sold products (`unit='quantity'`, sentinel pack 1) show **"pcs"** not "1 L"; sub-litre packs (0.037 L) show the exact value not "0.0 L" (packLabel no longer routes through the 1-decimal `litres()`).

**Browser-swept all 22 web pages on localhost:3000** (= prod code, [[local-dev-uses-live-prod]]): every page renders, **no console errors, no error boundaries**. IST date range, "0 km" (not null), live tracking freshness, billing history all confirmed.

**Consciously LEFT (documented in the report's Low section):** client-side caps already enforced server-side (credit-note/sales-return amounts, file size/type, products re-import 409-deduped); cosmetic (skeleton flash, blob-URL revokes, sub-0.5h display); by-design (permanent statement link, two-step collection write); latent/no-caller (lib/format negatives, server-api signal) and perf-only (polygon memo); neon-auth iss/aud binding (hardening, not exploitable with single-project JWKS). ⚠️ **Separately: the in-house Error Monitor (`/errors`) shows ~94 OPEN error groups (391 events, last seen ~1d)** — pre-existing captured API/web/mobile errors to triage.

Related: [[direct-invoice-backing-order]], [[billing-v2-webhook-architecture]], [[stock-quantity-products]], [[local-dev-uses-live-prod]], [[attendance-holiday-feature]].
