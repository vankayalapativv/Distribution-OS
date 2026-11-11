# Web app — 95% line coverage plan

Deferred. Picks up the same effort just completed for `apps/api` (now 100% line).
Target: **95% line coverage of `apps/web`**, measured as **true 95%** — see decision below.

## Decision (locked)
- **`coverage.all = true`.** Every source file counts, even ones no test imports.
  First action when resuming: flip this in `vitest.config.ts`, then re-run
  `pnpm test:coverage` to get the honest baseline (it will drop below the number
  below, because currently-invisible files start counting).

## Baseline (as measured, before `all:true`)
- **53.75% lines (4776 / 8884).** istanbul provider, jsdom, 384 test files / 1653 tests passing.
- To reach 95% from this scope: **~3,664 more covered lines across ~277 files** (186 at 0%, 91 partial).
- Caveat: 649 source files exist but only 628 are in the lcov report — **21 files are never imported by any test** and are invisible until `all:true` is set. The true baseline will be lower.

## Tooling (already in place — keep as-is)
- `vitest` + `@testing-library/react` + `@testing-library/jest-dom`, `jsdom` env.
- **istanbul** coverage provider on purpose — v8's bytecode instrumentation drops the jsdom jest-dom matcher extension across the suite; istanbul's babel transform leaves `expect` intact. Do **not** switch to v8.
- `@/*` → `src/*` alias; `server-only` stubbed at `src/test/server-only-stub.ts`.
- Setup: `src/test/setup.ts`. Only two helpers exist today (`setup.ts`, `server-only-stub.ts`) — consider a small shared render helper if provider-wrapping repeats.
- Established repo pattern: render components with testing-library and assert on cells/handlers; unit-test `*-api.ts` serializers and hooks directly. See `src/features/products/oil-columns.test.tsx` for the house style (cell-rendering helper, handler spies).

## Where the gap lives (biggest first)
| Area | Uncovered lines | Note |
|---|---|---|
| `features/reports` | 500 | **0 test files** (incl. `reports-aoa.ts` = 68) |
| `features/stock` | 366 | **0 test files** — `stock-journal.tsx` (175), `stock-dialogs.tsx` (110), `stock-api.ts` (47) |
| `features/settings` | 352 | **0 test files** — `settings-company.tsx` (49), `settings-bank.tsx` (48) |
| `features/super-admin` | 324 | `super-admin-add-user-dialog.tsx` (51) + others |
| `src/app/api` (17 BFF route handlers) | 248 | server-side; only 4 tests under `src/app` today |
| `src/app/(dashboard)` pages | 238 | Next server/client pages |
| `features/margin-simulator` | 215 | **0 test files** — `margin-row` (64), `margin-content` (53), `margin-entry-dialog` (46) |
| `features/invoices` | 191 | `invoice-generate.tsx` (71) + others |
| `features/billing` | 177 | **0 test files** — `billing-guard-v2` (50), `use-pay-checkout.ts` (46), `billing-card-v2` (44) |
| `features/market-intelligence` | 154 | **0 test files** |
| `components/ui` | 120 | `chart.tsx` (60) + others |
| `features/shell` | 114 | partial |
| `features/products` | 113 | partial |
| `features/errors` | 111 | **0 test files** — `error-detail-drawer.tsx` (48) |
| `features/dashboard` | 103 | partial (incl. `map/use-osm-map-init.ts` = 44) |
| `lib/neon-auth-server.ts` | 97 | server-only auth; mock fetch/cookies |
| `components/data-table` | 77 | partial |
| `features/reassign` | 75 | **0 test files** — `reassign-view.tsx` (68) |
| `features/collections` | 62 | partial |
| `features/incentives` | 57 | **0 test files** |
| `features/permissions` | 48 | **0 test files** — `permissions-view.tsx` (43) |
| `features/orders` | 41 | partial top-up |

Split by type: **~1,230 uncovered lines in `.ts`** (logic/api/hooks — cheapest, highest yield) and **~2,878 in `.tsx`** (components).

Feature areas with **zero test files** today: reports, stock, settings, billing, market-intelligence, errors, reassign, incentives, permissions.

## Execution (committable batches, biggest-gap-first)
Each batch: write tests → `pnpm test:coverage` (confirm the area climbs via lcov `LF`/`LH`) → `pnpm typecheck` → commit. Match the existing render-helper style; keep istanbul.

1. **Pure-logic `.ts`** (fast wins, ~1,230 lines): `stock-api`, `reports-aoa`, `billing/use-pay-checkout`, margin calc, `lib/neon-auth-server`, remaining `lib/*`, each feature's `*-api.ts`.
2. **Zero-test feature areas** (render + interact): reports, stock, settings, billing, market-intelligence, errors, reassign, incentives, permissions.
3. **Dialogs / forms**: super-admin, margin-simulator, invoices.
4. **BFF route handlers** (`src/app/api/*`, 17 handlers) + testable bits of `app/(dashboard)` pages (async server components: test what renders in jsdom; extract logic where a page is otherwise untestable).
5. **Partial top-ups** to push each remaining area over 95%: dashboard, products, collections, orders, shell, components/ui, components/data-table.
6. **MapLibre map last** (`features/dashboard/map`): mock `maplibre-gl` (jsdom has no WebGL/canvas GL) and assert on init/teardown logic.

## Known hard spots
- **MapLibre GL** — no WebGL in jsdom; mock the `maplibre-gl` module (Map, Marker, etc.) and test the init/teardown hook logic, not the GL rendering.
- **Next.js `app/(dashboard)` pages** — some are async server components; test the extractable logic and any client subcomponents. Don't fight the framework for a few lines.
- **`lib/neon-auth-server.ts`** — server-only; mock `fetch` and the cookie/`next/headers` access.
- **BFF route handlers** — invoke the exported `GET`/`POST` with a constructed `Request`; mock the upstream `fetch` to the API and the auth/cookie layer.

## Rough size
~6–7× the API-routes effort (that was 42 files; this is ~277). Expect many commits across multiple sessions. The `.ts` logic batch (step 1) alone should move the needle a lot for low effort.
