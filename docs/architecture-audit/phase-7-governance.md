# Phase 7 — Decisions & Governance

**Lens:** Ch. 19 — architecture is a stream of decisions; recording them keeps a solo project
coherent over years and makes it handoverable/sellable. This phase sets up the *future*, not the
code.

---

## Finding: decisions are recorded, but scattered — no ADR log

Significant decisions **are** captured, just informally and in many places: `PROJECT-MEMORY.md`
(3000+ lines), `docs/DECISION-live-tracking-multi-device.md`, and numerous `docs/*-PLAN.md` /
`*-AUDIT.md` files. There is no single, skimmable "what did we decide and why" index. This is a
governance gap (G-0701), not a code defect.

**Delivered this phase:** a lightweight ADR log under [`adr/`](adr/) with the format/template and
**5 backfilled ADRs** for the most significant decisions inferable from the codebase + history:

| ADR | Decision |
|-----|----------|
| [0001](adr/0001-modular-monolith-on-workers.md) | Modular monolith on Cloudflare Workers (not microservices) |
| [0002](adr/0002-neon-serverless-postgres.md) | Neon serverless Postgres via HTTP driver |
| [0003](adr/0003-single-client-silo.md) | Single-client silo — removed multi-tenant scaffolding (0034/0035) |
| [0004](adr/0004-neon-managed-auth.md) | Neon Managed Auth (EdDSA); retire HS256/PBKDF2 (0077) |
| [0005](adr/0005-partitioning-convention.md) | Domain-partitioned web, technically-partitioned backend |

> Dates/context are inferred from code + history — confirm against `PROJECT-MEMORY.md` before
> treating as canonical.

---

## Fitness functions to add (turn Phase 2's proposals into CI)

Prioritized; each maps to a gap and a characteristic. **Proposed, not implemented** (per the agreed
audit-only scope — implement with approval).

| # | Fitness function | Guards | Addresses | Effort |
|---|------------------|--------|-----------|--------|
| 1 | **CI gate** running `turbo run lint typecheck test` on push/PR — see [`proposed/ci.yml`](proposed/ci.yml) | correctness, maintainability | G-0201 | S |
| 2 | **No-cycle / import-boundary** rule (`eslint-plugin-boundaries` or `dependency-cruiser`) forbidding `lib → services` and any cycle | maintainability, simplicity | G-0101, G-0202 | S |
| 3 | **API ESLint config** + `apps/web` `typecheck` script so the gate covers the whole repo | maintainability | G-0203 | S |
| 4 | **SE-scope test**: SE-A cannot read SE-B's order/customer/collection by id (→ 404), over every SE-reachable by-id route | security | G-0601 | M |
| 5 | **Query-count assertion** in service tests (count `sql\`\`` per request path) to catch N+1s before they ship | cost, performance | G-0202, G-0401 | M |
| 6 | **Dependency hygiene** (`knip`/`depcheck`) in CI | cost, simplicity | G-0501, G-0202 | S |
| 7 | **Bundle-size budget** (web `@next/bundle-analyzer` threshold; RN) failing CI on regression | performance, cost | G-0202 | M |
| 8 | **Coverage floor** on `packages/db` money math + core services (Vitest `coverage.thresholds`) | correctness | G-0205 | M |
| 9 | **Env validation** at Worker start + complete `.env.example` | simplicity, SaaS | G-0502 | S |

**Do first:** #1 (CI gate) — it activates the 516 tests you already have. Then #2 and #4 (both
catch a *class* of the audit's findings automatically), then #3.

---

## "Definition of ideal" as a living checklist

The [`README.md`](README.md) §"Definition of ideal" is the checklist to re-run periodically (e.g.
each release or quarter). Suggested cadence: re-run this audit's phases 1, 2, and 6 as a lightweight
self-review, and add an ADR whenever a decision in the checklist changes. That closes the loop
Ch. 19 describes — the audit becomes a repeatable fitness function itself, not a one-off.

---

## Coverage (ledger) note
Phase 7 is process/governance; it reviewed `PROJECT-MEMORY.md`, `docs/DECISION-*.md`, and the
CI/turbo config (non-ledger docs/config), and produced the ADRs + CI proposal. No new source files
were read.
