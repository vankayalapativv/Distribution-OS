# Gap Report — Distribution OS Architecture Audit

Every finding, in every phase, is one row here. Nothing lives only in chat.
This report is **sorted at the end** by Severity, then Effort (do the cheap Criticals first).

## Legend

- **Severity:** `Critical` (data leak / correctness / blocks SaaS) → `High` → `Medium` → `Low`.
- **Effort:** `S` (<½ day) · `M` (½–2 days) · `L` (>2 days).
- **Trade-off** is **mandatory** — per the book, every fix costs something (cost/simplicity/etc.);
  naming it prevents "fixing" our way into worse simplicity or cost.

## Row template

```
| ID | Phase | Finding | Book principle | Severity | Affected characteristic(s) | Recommendation | Effort | Trade-off |
```

---

## Findings

| ID | Phase | Finding | Book principle | Severity | Affected characteristic(s) | Recommendation | Effort | Trade-off |
|----|-------|---------|----------------|----------|----------------------------|----------------|--------|-----------|
| G-0102 | 1 | `packages/shared` is empty & unused; API request/response contracts duplicated across api/web/mobile (94+ type defs in web `*-api.ts` alone) | Connascence of type/meaning across quanta (Ch. 3, 7) | High | Maintainability, feature velocity | Populate `packages/shared` with the API contract types (+ `Role`/`roles`) and import from all three apps | L | Adds a build/versioning step to the shared package (mild simplicity cost) — but removes triplicated contracts |
| G-0103 | 1 | Role codes hardcoded 834× across the 3 apps (api 495, web 324, mobile 15); no single source of truth | Connascence of meaning/value (Ch. 3) | Medium | Maintainability, velocity | Central `roles` const + `Role` type in `packages/shared`; replace literals | M | Central constant adds an import at each site; cross-app payoff depends on G-0102 |
| G-0104 | 1 | God-files in service layer: orders.ts 1795, customers.ts 1603, collections.ts 1022, invoices.ts 902 LOC | Cohesion / module size (Ch. 3) | Medium | Maintainability | Split each into domain-cohesive sub-modules (e.g. orders/{create,list,fulfilment}) | M | Over-splitting can fragment cohesion & add indirection; keep sub-modules domain-aligned |
| G-0101 | 1 | Cross-layer import cycle `lib/db → lib/errors → services/errors → lib/db` (infra imports business logic) | Coupling / acyclic dependencies (Ch. 3) | Medium | Maintainability | Invert: pass `captureError` in, or move it into `lib/`; break the `lib→services` edge | S | Minimal; slight change to error-capture wiring |
| G-0105 | 1 | Mobile `lib/` is a 178-file flat directory (only 5 subdirs) mixing infra, hooks, utils | Cohesion (Ch. 3) | Medium | Maintainability, simplicity | Sub-folder by concern (gps/, sync/, auth/, api/, domain/) | M | Import-path churn during the move; no behaviour change |
| G-0107 | 1 | Backend top-level partitioning is technical (`routes/`,`services/`,`lib/`), not domain | Technical vs domain partitioning (Ch. 8) | Medium | Maintainability, velocity, SaaS evolvability | Optionally regroup into domain modules (each owns route+service+types); web already does this | L | Large multi-file churn with real risk; current scheme is consistent & navigable — treat as conscious trade-off |
| G-0106 | 1 | Inline SQL in 3 route handlers (`invoicing-pdf.ts`, `me.ts`, `system-settings.ts`) vs the thin-route convention | Business logic leaking into handlers (Ch. 8) | Low | Maintainability | Move the queries into the matching service | S | Negligible |
| G-0201 | 2 | No CI quality gate: the only workflow is a tag-triggered release; lint/typecheck/tests (516 test files) never run automatically | Fitness functions must execute to govern (Ch. 6) | High | Maintainability, correctness, velocity | Add push/PR workflow running `turbo run lint typecheck test` | S | CI minutes + a few min per push; tiny vs. the erosion it prevents |
| G-0202 | 2 | No fitness functions for maintainability (import-boundary/cycle/complexity), performance (bundle/perf budget), or cost (query/subrequest/CPU) | Uncontrolled characteristics erode (Ch. 6) | Medium | Maintainability, performance, cost, simplicity | Add cycle/boundary lint, bundle-size budget, query-count assertions | M | Each check adds CI time + occasional false positives to tune |
| G-0203 | 2 | Inconsistent static analysis: `apps/api` has no ESLint/lint; `apps/web` has no `typecheck` script; db/shared lint are stubs | Consistent governance (Ch. 6) | Medium | Maintainability | Add API ESLint config + web typecheck script; real lint in packages | S | Small setup; may surface a backlog of lint warnings to clear |
| G-0204 | 2 | No pre-commit hooks (no husky/lint-staged); AGENTS.md "never skip hooks" rule guards nothing | Fitness functions (Ch. 6) | Medium | Maintainability | Add husky + lint-staged running lint/typecheck on staged files | S | Slightly slower commits; solo-dev may prefer CI-only |
| G-0205 | 2 | `packages/db` (79 migrations + money math) has 0 tests; no coverage measurement in any app | Test as fitness function (Ch. 6) | Medium | Correctness | Add money-math/migration tests + Vitest coverage thresholds on core services | M | Writing/maintaining tests is real effort; target only high-value logic |
| G-0206 | 2 | Release workflow uploads to Indus under stale `com.vardhansystems.beyond` while app is `...sriaparajita` | Deliberate, recorded decisions (Ch. 6/19) | Low | Correctness (release ops) | Verify/rename the Indus package identifier | S | May be intentional (existing store listing) — verify before changing |
| G-0302 | 3 | Client-specific values hardcoded across ~40 files (branding "Sri Aparajita" in 37, catalogue, BAL invoice format, emails, R2 bucket); only 2 `system_settings` keys — every new client is a code fork | Architecture quantum / config as first-class (Ch. 7) | High | SaaS evolvability, maintainability | Extract client identity into config (table/branding file/env) so onboarding needs zero code edits | L | Adds a config layer + indirection (mild simplicity cost) — but is the gate to any SaaS road and improves single-client builds |
| G-0303 | 3 | No migration runner or tracking table; 79 migrations applied by hand via `psql`; prod + dev share ONE Neon DB | Deployment/operational quantum (Ch. 7) | High | SaaS evolvability, simplicity, correctness | Add a migration runner + `schema_migrations` tracking; separate prod/dev DBs | M | Runner is a new small tool to maintain; separating DBs adds one env — both remove present-day risk |
| G-0304 | 3 | Provisioning script `packages/db/src/setup.ts` still PBKDF2-writes `password_hash` (dropped in migration 0077); `pnpm setup` is broken — no working automated onboarding | Deliberate, recorded decisions (Ch. 19) | Medium | SaaS evolvability, simplicity | Rewrite `setup.ts` to seed roles + a Neon-auth-linked admin + base `system_settings`; drop password logic | M | Requires reconciling with Neon-managed auth bootstrap |
| G-0301 | 3 | No tenant/client seam in the resolved auth identity (`{userId, role, externalUserId}`) | Architecture quantum (Ch. 7) | Medium | SaaS evolvability | If SaaS is intended, add a `tenant` field to the identity now (constant today) so the pipeline seam exists | S | Only worth it if SaaS is a real intention; otherwise it is speculative generality (a Phase-5 anti-pattern) |
| G-0305 | 3 | Prior brand "beyond"/"Beyond" leftover in 9 files (`opening-balance-fifo.ts`, `result-screens.tsx`, `hero-card.tsx`, `settings-sections.tsx`, `icon.svg`, tests) | Connascence of client identity (Ch. 3) | Low | Maintainability | Replace with config (folds into G-0302) or correct the strings | S | Negligible; symptom of branding-by-find/replace |
| G-0401 | 4 | N+1 on the hottest write path: `tracking-sessions.ts:337` inserts one GPS point per round-trip in a loop (every SE, all day) | Batch DB writes / subrequest budget (Ch. 4) | High | Performance, cost | One multi-row `INSERT … ON CONFLICT DO NOTHING RETURNING`, diff ids for duplicates | M | Slightly more complex insert + duplicate-detection logic |
| G-0402 | 4 | Order line-item inserts loop with individual `await sql` (orders.ts:1365–1413), N+1 and outside the transaction used elsewhere (non-atomic) | Batch writes (Ch. 4) + transactional integrity | Medium | Performance, correctness | Multi-row INSERT per item kind, inside the order `sql.transaction` batch | M | Rework of order-create write path; verify with tests |
| G-0403 | 4 | N+1 on money path: collection reconciliation loops 2 writes/allocation (`collections.ts:909`) + nested reversals in `reReconcileCustomer` | Batch writes (Ch. 4) | Medium | Performance, cost | Batch allocation writes into set-based statements in the existing transaction | M | Careful — financial code; needs strong test coverage before change |
| G-0404 | 4 | Every request does 2+ uncached DB round-trips for auth (profile + `effectivePermissionsForRole`) though role→perms rarely change | Caching / operational perf (Ch. 4) | Medium | Performance, cost | Cache per-role permissions (Cache API/KV or in-isolate memo w/ TTL) | M | Adds cache-invalidation to reason about when permissions change |
| G-0405 | 4 | Redundant duplicate indexes (collections_customer×2, orders_customer×2, 3× gps_points user+time) add write/storage cost | Operational cost (Ch. 4) | Low | Cost | Drop redundant indexes after checking query plans | S | Must verify no plan depends on the specific duplicate before dropping |
| G-0502 | 5 | 28 distinct env vars referenced but `.env.example` documents only 6; no boot-time env validation | Simplicity as a chosen characteristic (Ch. 4) | Medium | Simplicity, SaaS evolvability | Complete/commented `.env.example` + validate required env at Worker start | S | Keeping the example in sync is light ongoing upkeep |
| G-0501 | 5 | `leaflet.markercluster` declared in web but has 0 references (unused dependency) | Complexity must earn its place (Ch. 4) | Low | Cost, simplicity | Remove the dependency; add `knip`/`depcheck` as a CI fitness function | S | Negligible; verify no runtime dynamic import first |
| G-0601 | 6 | SE data-scoping (`assertCustomerVisible`) is convention-enforced per-handler; no middleware/test guarantees it — a future SE-reachable endpoint could omit it | Cross-cutting concern / isolation is a security property (Ch. 4) | High | Security, SaaS evolvability | Add a fitness-function test (SE-A cannot read SE-B's record → 404) over every SE by-id route; consider a scoping helper | M | Tests to write/maintain; no current hole found, this prevents regressions |
| G-0602 | 6 | No systematic input validation at API boundaries (manual per-field checks, no schema/Zod); injection-safe but semantic validation is inconsistent | Input validation at trust boundaries (Ch. 4) | Medium | Correctness, maintainability | Add a shared request-schema layer (doubles as the `packages/shared` contract, G-0102) | L | A validation lib + schemas add code; pairs with the shared-contract work |
| G-0701 | 7 | Decisions are recorded but scattered (PROJECT-MEMORY + ad-hoc DECISION/PLAN docs); no structured ADR index | Architecture is a stream of decisions (Ch. 19) | Low | Maintainability, SaaS evolvability | Adopt the ADR log (delivered under `adr/`); add an ADR when a decision changes | S | Light ongoing discipline to keep it current |

---

## Resolution log — 2026-09-20 (the 6 High findings)

| ID | Status | What was done |
|----|--------|---------------|
| G-0201 | ✅ Done | `.github/workflows/ci.yml` added — typecheck + test **blocking** (green), lint non-blocking until the backlog clears. |
| G-0401 | ✅ Done | GPS ingestion batched into ONE `sql.transaction` round-trip (`on conflict do nothing`), single latest-location upsert. Tests updated + green. |
| G-0102 | ◑ Slice | `@sri-aparajita/shared` populated (`Role`, `ROLES`, `ApiResponse`, `BRAND`) and wired into **api + web** as the seam (mobile deferred — Metro). |
| G-0302 | ◑ Slice | `BRAND` config consumed by api (`api-response`, `health-monitor`) + web (`layout`). Emails/bucket confirmed already env/wrangler. Remaining branding sites = follow-up. |
| G-0303 | ◑ Runner | `packages/db/src/migrate.ts` migration runner + `schema_migrations` tracking (`migrate` / `--status` / `--baseline`). **DB split is owner's Neon action** (see below). |
| G-0601 | ✅ Done | SE read-scope fitness tests added (SE-A cannot read SE-B's customer/invoices → 404); central `assertCustomerVisible` gate covered. |

**Also fixed en route (green-first prerequisites):** all **13 pre-existing API test failures**
(root cause: POST routes use `c.executionCtx.waitUntil` with no ctx in tests → added
`lib/wait-until.ts` `waitUntilSafe`; plus stale customer-SE-validation, renamed visit tag, and
collection verify/reconcile mock drift). API suite now **548/548 green**. Web `server-only` vitest
resolution fixed; web `typecheck` script added; whole monorepo **`turbo run typecheck test` = 10/10**.

**Owner action for G-0303:** on the shared prod DB run `pnpm --filter @sri-aparajita/db run migrate -- --baseline`
once (records the 79 existing migrations as applied without re-running them), then split prod/dev
into separate Neon databases and set each `DATABASE_URL`.

## Notes carried forward (not yet defects)

- **Tenancy divergence (→ Phase 3):** the playbook assumes per-customer→SaaS; the repo
  deliberately removed `organization_id` (migrations 0034/0035) and is single-client today.
  To be framed in Phase 3 as a conscious trade-off (stay single-client vs. re-introduce
  multi-tenancy for SaaS priority #4), not filed as a defect. See
  [`phase-0-inventory.md`](phase-0-inventory.md) §7.
