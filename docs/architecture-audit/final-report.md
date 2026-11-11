# Final Report — Distribution OS Architecture Audit

Completed 2026-09-20 across all 8 phases (0–7) of the playbook, against the six prioritized
characteristics: maintainability, feature velocity, performance, SaaS evolvability, low cost,
simplicity. Full per-phase detail: [`README.md`](README.md). Every finding: [`gap-report.md`](gap-report.md).

---

## Verdict

**This is a well-built single-client system, not a big ball of mud.** It has low backend coupling
(1 cycle in 203 files), thin routes, injection-safe parameterized data access, centralized authz,
non-leaky errors, real SE data-scoping, strong index coverage, and a genuinely lean dependency/dead-
code profile. The deliberate simplifications (remove multi-tenancy 0034/0035, remove offline code,
retire legacy auth 0077) paid off.

**The gaps cluster into three themes**, none requiring microservices or a rewrite:

1. **Governance loop is missing** (highest leverage, cheapest): 516 tests exist but **no CI runs
   them**; no fitness functions guard the six priorities. → G-0201, G-0202, G-0203, G-0204, G-0205.
2. **Write paths are N+1 and sometimes non-atomic** over Neon's HTTP driver — the main perf/cost
   *and* a correctness risk. → G-0401 (GPS, hottest), G-0402/0403 (order/collection, financial).
3. **SaaS is gated by hardcoded config + manual DB ops**, and prod/dev share one DB (a present-day
   risk regardless of SaaS). → G-0302, G-0303. The tenancy road is a conscious decision (Phase 3),
   not a defect.

---

## Full gap report — sorted by Severity, then Effort

**Do the cheap Criticals/Highs first.** (No Criticals — single-tenant-per-DB means no cross-tenant
leak, and no current auth/scope hole was found.)

### 🔴 High
| ID | Sev·Eff | Finding | Fix | Characteristic |
|----|---------|---------|-----|----------------|
| G-0201 | High·**S** | No CI gate — 516 tests/lint never run automatically | Add `ci.yml` running `turbo run lint typecheck test` | correctness, maintainability |
| G-0401 | High·M | N+1 on the hottest write path (GPS point ingestion) | One multi-row INSERT … ON CONFLICT | performance, cost |
| G-0102 | High·L | `packages/shared` empty & unused → contracts duplicated across 3 apps | Populate shared package with contract types + `Role` | maintainability, velocity |
| G-0302 | High·L | Client identity hardcoded in ~40 files → every new client is a code fork | Extract to config (table/branding/env) | SaaS, maintainability |
| G-0303 | High·M | No migration runner/tracking; prod & dev share one DB | Add runner + `schema_migrations`; split prod/dev DBs | SaaS, correctness, simplicity |
| G-0601 | High·M | SE scoping is convention-enforced, not test/middleware-guaranteed | Add SE-scope fitness test over every by-id route | security |

### 🟠 Medium
| ID | Sev·Eff | Finding | Fix |
|----|---------|---------|-----|
| G-0203 | Med·S | `apps/api` unlinted; web has no `typecheck` script; db/shared lint stubs | Add API ESLint + web typecheck |
| G-0204 | Med·S | No pre-commit hooks | husky + lint-staged |
| G-0502 | Med·S | 28 env vars, only 6 documented; no boot validation | Complete `.env.example` + validate at start |
| G-0103 | Med·M | Role codes hardcoded 834× across apps | Central `roles` const/type (with G-0102) |
| G-0104 | Med·M | God-files (orders 1795, customers 1603, collections 1022, invoices 902) | Split into domain sub-modules |
| G-0105 | Med·M | Mobile `lib/` 178 flat files | Sub-folder by concern |
| G-0202 | Med·M | No maintainability/perf/cost fitness functions | Cycle lint, bundle budget, query-count assertion |
| G-0205 | Med·M | `packages/db` money math untested; no coverage measurement | Money-math tests + coverage floor |
| G-0304 | Med·M | `setup.ts` broken (writes dropped `password_hash`) | Rewrite for Neon-auth bootstrap |
| G-0402 | Med·M | Order line-items N+1 **and** non-atomic | Multi-row INSERT inside the transaction |
| G-0403 | Med·M | Collection reconciliation N+1 on money path | Batch allocation writes in the transaction |
| G-0404 | Med·M | 2+ uncached auth DB round-trips per request | Cache per-role permissions |
| G-0602 | Med·L | No systematic input validation (no schema/Zod) | Shared request-schema layer (with G-0102) |
| G-0101 | Med·S | Cross-layer import cycle `lib → services/errors` | Invert the error-capture dependency |
| G-0107 | Med·L | Backend technically-partitioned, not domain (divergence from "ideal") | Conscious trade-off — regroup only if velocity suffers |
| G-0301 | Med·S | No tenant seam in the auth identity | Add a `tenant` field **iff** SaaS is intended (else skip) |

### 🟡 Low
| ID | Sev·Eff | Finding | Fix |
|----|---------|---------|-----|
| G-0106 | Low·S | Inline SQL in 3 route handlers | Move to services |
| G-0206 | Low·S | Release workflow uploads stale `...beyond` package | Verify/rename Indus identifier |
| G-0305 | Low·S | "beyond" brand leftover in 9 files | Fold into config (G-0302) |
| G-0405 | Low·S | Redundant duplicate indexes | Drop after checking plans |
| G-0501 | Low·S | `leaflet.markercluster` unused dependency | Remove; add depcheck |
| G-0701 | Low·S | Decisions scattered; no ADR index | ADR log delivered under `adr/` |

**Totals:** 28 findings — **0 Critical, 6 High, 16 Medium, 6 Low.**

---

## Recommended sequence (cheap-first, highest leverage)

1. **G-0201 — CI gate (S).** One workflow activates your 516 tests. Biggest ROI in the audit.
2. **G-0203 (S)** so the gate covers api/web fully; then **G-0101 (S)** + **G-0405/0501 (S)** cheap cleanups.
3. **G-0401 (M)** — batch the GPS insert: the top perf+cost win. Then **G-0402/0403** to fix N+1 **and** the financial-atomicity risk together.
4. **G-0303 (M)** — split prod/dev DBs + migration runner: retires the top-rated risk (Phase 6 storm).
5. **G-0601 (M)** — SE-scope test: makes the isolation guarantee real.
6. **Decision point:** SaaS or not (Phase 3). If yes → **G-0302 + G-0303 + G-0301** are the road. If no → still do G-0302/G-0303 for *this* client's safety and onboarding.
7. The rest (G-0102/0103/0104/0105/0107/0602) as maintainability investments as velocity demands.

---

See [`coverage-report.md`](coverage-report.md) for what was and wasn't opened.
