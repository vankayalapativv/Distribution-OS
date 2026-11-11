# Coverage Report — Distribution OS Architecture Audit

The playbook requires that "skipped" is always a **deliberate, recorded decision**. This report
states the review method and exactly what was and wasn't opened, and why.

## Review method (honest statement)

The audit combined **two levels of review**, both applied across the whole repo:

1. **Structural / graph-level review of 100% of the codebase** — every source file participated in:
   - the import-graph analysis (fan-in/fan-out + cycle detection over all 203 `apps/api/src` files);
   - directory/partition + cohesion analysis (all `apps/web`, `apps/mobile`, `packages`);
   - repo-wide grep-level scans for each phase's lens (N+1 loops, `sql.unsafe`/injection, hardcoded
     secrets, role literals, dead-table refs, env vars, `console.*`, TODO/deprecated, etc.);
   - the live database schema (72 tables, 210 indexes) and all CI/build/config.
2. **Line-by-line deep reads** of the files where findings concentrated — **24 files** marked
   `[x]` in [`coverage-ledger.md`](coverage-ledger.md) (the Worker entry, db/errors/authz, the four
   god services, auth middleware, provisioning, the N+1 hot paths, the scoped routes, the error
   handler, etc.).

So **every file was reviewed for the audit's lenses** via (1); the ledger's `[x]` marks the subset
that also received a full (2) read. "Not `[x]`" means "not individually deep-read," **not**
"ignored."

## What was NOT individually deep-read, and why (deliberate)

| Category | ~Count | Why not line-by-line |
|----------|--------|----------------------|
| `apps/web` feature UI files (`features/*/**.tsx`) | ~900 | Reviewed structurally as a **domain partition** (Phase 1) + contract inspection (Phase 6). UI-component internals don't change the architectural findings; a per-component review is a maintainability task, not an architecture-audit need. |
| Test files (`*.test.ts[x]`) | ~516 | Counted and assessed as an **asset** (Phase 2: they exist but aren't gated). Their internals weren't audited — the finding is about *governance*, not test content. |
| `apps/mobile` `components/` + `lib/` internals | ~360 | Reviewed structurally (Phase 1: 178-flat-file cohesion smell; Phase 5: deps; Phase 6: role scan). Native/GPS internals deep-read only where hot (tracking-sessions). |
| Generated/data files (e.g. `telangana-boundary.ts` GeoJSON, `*.d.ts`) | few | Data, not logic — no architectural signal. `*.d.ts` excluded from the ledger by design. |
| `apps/mcp` (fourth app) | — | **Outside the agreed scope** (api/web/mobile/packages). Recorded in Phase 2 — flag if you want it folded in. |
| Build artifacts (`.next`, `.wrangler`, `dist`, `.expo`) | — | Excluded from the ledger (not source). |

## Ledger state

- **1765** source files in scope; **24** individually deep-read (`[x]`).
- 100% received structural/lens-level review; the remainder were deliberately not deep-read per the
  categories above.

## If you want deeper coverage

The honest way to raise line-by-line coverage is **not** to have one pass read 1765 files — it's to
add the Phase 7 **fitness functions** (cycle lint, SE-scope test, query-count assertion, coverage
floor). Those give *continuous, automated* per-file coverage for the properties that matter, which
is the book's actual goal (Ch. 6) — durable governance over a one-time exhaustive read.

## Nothing skipped silently

No file in scope was skipped without falling into a recorded category above. The one **scope
exclusion** to confirm with the owner is **`apps/mcp`**.
