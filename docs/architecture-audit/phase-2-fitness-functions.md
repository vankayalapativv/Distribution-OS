# Phase 2 — Characteristics → Fitness Functions

**Lens:** Ch. 4–6. Uncontrolled characteristics erode; **fitness functions** (automated
tests/CI checks) make the six priorities *enforceable* instead of aspirational. This phase asks,
per priority: (a) is it measurable today, (b) is any automated check guarding it, (c) if not, what
concrete check could be added.

Scope reviewed: `.github/workflows/`, `turbo.json`, root + per-package `package.json` scripts,
ESLint configs, Vitest configs, git hooks, and the test corpus.

---

## The headline

There is a **substantial test corpus (516 test files: api 62 · web 418 · mobile 36)** and
partial linting — but **almost none of it is automated as a gate.** The single CI workflow is a
**tag-triggered release** (`indus-release.yml`: build APK on EAS → upload to Indus Appstore); it
runs **no lint, no typecheck, no tests**. There are **no git hooks** (no husky/lint-staged; only
`.git/hooks/*.sample`). So every one of the six characteristics can silently erode between
releases — exactly the failure mode Ch. 6 warns against. The tools exist; the *governance loop*
does not.

---

## Priority-by-priority scorecard

| # | Priority | Measurable today? | Automated fitness function? | Notes |
|---|----------|-------------------|-----------------------------|-------|
| 1 | Maintainability | Partly | ❌ none enforced | ESLint on web+mobile, `tsc` scripts, but no import-boundary/cycle/complexity check; nothing in CI |
| 2 | Feature velocity | No | ❌ | No metric (e.g. cycle-detection, contract-drift) tracked |
| 3 | Performance | No | ❌ | No bundle-size budget, no response-time assertion, no perf test |
| 4 | SaaS evolvability / tenant isolation | N/A today | ❌ | Single-client; no tenant-scope tests (see Phase 3) |
| 5 | Low cost | No | ❌ | No check on query counts, subrequests, or Worker CPU time |
| 6 | Simplicity | No | ❌ | No dependency-count/complexity/dead-code check |
| — | Correctness | Yes (516 tests) | ⚠️ exists but **not gated** | No CI run, no coverage floor; `packages/db` (money/migrations) has **0 tests** |

---

## What exists (record the assets)

- **Vitest configured in all four apps** (`apps/api`, `apps/web`, `apps/mobile`, `apps/mcp`) — 516
  test files total. Web is especially well-tested (418).
- **ESLint** on `apps/web` (`eslint.config.mjs`) and `apps/mobile` (`eslint.config.js`, `expo lint`).
- **`tsc --noEmit` typecheck** scripts on api, mobile, db, shared.
- **Turbo pipeline** defines `lint`, `test`, `typecheck` tasks — so a one-command gate is *possible*
  (`turbo run lint typecheck test`), it just isn't triggered by anything.

## What's missing (→ gap report)

### G-0201 · No CI quality gate — lint/typecheck/tests never run automatically — High
The only workflow (`indus-release.yml`) triggers on tags/dispatch and does deploy work only. No
push/PR workflow runs `lint`, `typecheck`, or `test`. The 516 tests and the lint rules protect
nothing automatically. *Ch. 6 — fitness functions must be executed to govern.*

### G-0202 · No fitness functions for maintainability, performance, or cost — Medium
None of priorities #1 (beyond lint), #3, #5, #6 are guarded by any automated check:
no import-boundary/cycle rule (the Phase 1 cycle G-0101 would have been caught), no
bundle-size/perf budget, no query-count/subrequest/CPU-time check. *Ch. 6.*

### G-0203 · Inconsistent static analysis across packages — Medium
`apps/api` — the architectural core — has **no ESLint config and no `lint` script**.
`apps/web` has **no standalone `typecheck` script** (relies on `next build`'s type-check).
`packages/db` / `packages/shared` lint is a stub (`echo "No lint configured yet"`). So
`turbo run lint` / `turbo run typecheck` silently skip parts of the codebase. *Ch. 6.*

### G-0204 · No pre-commit hooks — Medium
No husky/lint-staged/simple-git-hooks; `.git/hooks` holds only samples. Nothing runs before a
commit, so lint/type errors reach the branch freely. (Note: `AGENTS.md` rule "never skip git
hooks" implies hooks are expected, but none are installed — the rule currently guards nothing.)

### G-0205 · Money/migration code untested; no coverage measurement — Medium
`packages/db` (79 migrations + seed/setup) has **0 tests**, and no app has a Vitest **coverage**
config, so there is no coverage floor and no visibility into which core domain logic
(order totals, collection reconciliation, invoice/GST math) is actually exercised. *Ch. 6.*

### G-0206 · Release workflow uploads under a stale package name — Low
`indus-release.yml` uploads to Indus with `package_name: "com.vardhansystems.beyond"`, but the
built app is `com.vardhansystems.distributionos` (app.json). Likely a re-client leftover — verify
whether the Indus listing identifier is intentionally still `beyond`. *(governance/correctness)*

---

## Proposed fitness functions (to implement in Phase 7, not now)

Concrete, cheap, and matched to the Workers/Neon/solo-dev context:

1. **CI gate workflow** (`.github/workflows/ci.yml`, on push + PR): `pnpm install --frozen-lockfile`
   then `turbo run lint typecheck test`. Turns the existing 516 tests + lint into a real gate.
   *(guards: correctness, maintainability)*
2. **Import-boundary / no-cycle check** — add `eslint-plugin-boundaries` or a `dependency-cruiser`
   rule forbidding `lib → services` and any cycle; would have caught G-0101 automatically.
   *(guards: maintainability, simplicity)*
3. **API ESLint config** so the backend core is linted like the rest. *(maintainability)*
4. **Bundle-size budget** for web (`@next/bundle-analyzer` threshold) and RN; fail CI on regression.
   *(performance, cost)*
5. **Query-count assertion** in service tests (count `sql\`\`` calls per request path) to catch
   N+1s before they ship — a cost/perf fitness function tailored to Neon's HTTP driver.
   *(cost, performance)*
6. **Coverage floor** on `packages/db` money math + core services (Vitest `coverage.thresholds`).
   *(correctness)*
7. **Living "definition of ideal" checklist** (from `README.md` §Definition) re-run each release.
   *(all)*

---

## Coverage (ledger) update

Reviewed this phase and marked `[x]`: `apps/web/eslint.config.mjs`, `apps/mobile/eslint.config.js`,
`apps/api/vitest.config.ts`, `apps/web/vitest.config.ts`, `apps/mobile/vitest.config.ts`.
Non-ledger config also reviewed: `.github/workflows/indus-release.yml`, `turbo.json`, all
`package.json` script blocks.

**Scope note:** a fourth app, **`apps/mcp`** (`@distribution-os/mcp`, excluded from `dev` and given
its own `vitest.config.ts`), exists but is **outside the agreed audit scope** (api/web/mobile/
packages). Recorded here so "not reviewed" is a deliberate, logged decision — flag if you want it
folded into scope.
