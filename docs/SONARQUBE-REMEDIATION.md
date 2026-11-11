# SonarQube Remediation Plan

Phased cleanup of the SonarCloud findings for the whole monorepo (web + api + mobile + packages).

- **Dashboard:** https://sonarcloud.io/dashboard?id=vankayalapativv_Sri-Aparajita-Distribution-OS
- **Org / project:** `vankayalapativv` / `vankayalapativv_Sri-Aparajita-Distribution-OS`
- **Scan config:** [`sonar-project.properties`](../sonar-project.properties); run with `SONAR_TOKEN=… pnpm sonar`
- **Scope:** everything, **including `apps/mobile`** (JS-only changes ship via OTA).

## Baseline (first full analysis, 2026-11-03)

| Metric | Value | Rating |
|---|---|---|
| Lines of code | 90,205 | — |
| Bugs | **29** | Reliability **D** |
| Vulnerabilities | 0 | Security **A** |
| Security hotspots | 0 | Review **A** |
| Code smells | 1,170 | Maintainability **A** |
| Technical debt | ~6,736 min (~112 h) | — |
| Duplication | 1.0% | — |
| Coverage | 0.0% (no report uploaded) | — |

## Workflow for every phase

1. Make the fixes.
2. `pnpm lint && pnpm typecheck && pnpm check:cycles` (fix anything that breaks — never `--no-verify`).
3. Re-scan: `SONAR_TOKEN=… pnpm sonar`, wait for the compute-engine task, confirm counts dropped.
4. Commit the phase (stage specific files).

---

## Phase 0 — Guardrails  ✅

- [x] Commit `sonar-project.properties` + add `pnpm sonar` script.
- [x] Add this tracking doc.
- [ ] (Manual, SonarCloud UI) Assign a **Quality Gate** to gate new code.

## Phase 1 — Bugs → Reliability off **D**  ✅  (done 2026-11-03 — bugs 29 → 0, Reliability **D → A**)

### 1a — Unreliable sort, add `localeCompare` comparator (9 · CRITICAL · S2871)
- [ ] `packages/db/src/migrate.ts:42`
- [ ] `apps/api/src/services/reports-visits.ts:85`
- [ ] `apps/api/src/services/reports-visits.ts:137`
- [ ] `apps/web/src/features/stock/stock-dialogs.tsx:78`
- [ ] `apps/web/src/features/invoices/invoice-line-table.tsx:48`
- [ ] `apps/web/src/features/invoices/invoice-line-table.tsx:50`
- [ ] `apps/web/src/features/invoices/invoice-generate.tsx:92`
- [ ] `apps/web/src/features/tracking/tracking-map.tsx:99`
- [ ] `apps/mobile/src/lib/order/use-catalogue.ts:30`

### 1b — MAJOR bugs (7)
- [ ] `packages/db/src/setup.ts:121` — floating promise (`void`/`await`/`.catch`)
- [ ] `packages/shared/src/invoice-pdf.ts:228` — conditional returns same value both branches
- [ ] `apps/web/src/features/settings/settings-godowns.tsx:83` — floating promise
- [ ] `apps/web/src/features/settings/settings-godowns.tsx:106` — floating promise
- [ ] `apps/web/src/features/settings/settings-company.tsx:56` — identical operands around `&&`
- [ ] `apps/mobile/scripts/reset-project.js:108` — floating promise
- [ ] `apps/mobile/src/lib/use-auth-gate.ts:23` — floating promise

### 1c — a11y: clickable non-interactive element needs a keyboard listener (13 · MINOR)
- [ ] `settings-dialog.tsx:85`, `:86`
- [ ] `invoice-row-actions-menu.tsx:26`
- [ ] `error-detail-drawer.tsx:75`
- [ ] `market-intelligence-media.tsx:61`
- [ ] `task-detail-drawer.tsx:27`, `:28`
- [ ] `logistics-run-drawer.tsx:65`, `:68`
- [ ] `logistics-detail-modal.tsx:85`, `:88`
- [ ] `logistics-media.tsx:71`
- [ ] `order-row-actions-menu.tsx:39`

**Target:** 0 bugs, Reliability **A**.

---

## Phase 2 — Blockers (2 · test integrity)  ✅  (done 2026-11-03 — 2 → 0 BLOCKERs)
- [x] `apps/web/src/features/audit-logs/audit-logs-columns.test.tsx:60` — assert array non-empty + each skeleton cell renders a node
- [x] `apps/web/src/features/expenditures/expenditures-columns.test.tsx:53` — assert array non-empty + each skeleton cell renders a node

## Phase 3 — High-value code smells  ✅ (S3776/S6478/S6479 done; S1874 all but 5)
- [x] 44 · high cognitive complexity (S3776) — **all 44 done 2026-11-03**,
      every one a behaviour-preserving extraction (verified per layer):
      - **Web (13):** `reports-view`, `stock-journal`, `billing-card-v2`,
        `billing-guard-v2`, `super-admin-user-sessions` (+ unit test),
        `error-detail-drawer`, `margin-row`, `margin-entry-dialog`,
        `settings-mcp-inbound`, `dashboard/map/use-district-layer`,
        `metrics-drilldown-dialog`, `dues-drilldown`, `invoice-generate` — each
        rendered live on the localhost dev server (reports drill-in, stock tabs,
        billing statement + grace banner, errors drawer, margin dialog, MCP tab,
        Telangana district map).
      - **Shared (1):** `invoice-pdf` `buildInvoiceDoc` (48→) decomposed into draw
        helpers; output **proven byte-identical** to the pre-refactor renderer for
        both intra- and inter-state invoices.
      - **API (10):** `visits.checkIn` (33→), `collections.reconcileCollection` +
        `applyHeldCreditToOpenInvoices`, `routes/collections` POST,
        `invoicing.generateInvoice` + `editGeneratedInvoice`, `customers-ledger`
        `assembleLedger`, `deliveries.addStop`, `reports.buildBrandsSummary`,
        `tracking-distance.calculateTrackingDistance` — guarded by the full API
        suite (595 tests) + the Worker bundle (`wrangler deploy --dry-run`).
      - **MCP (2):** `admin.handleAdminRoute` (28→), `auth.authHandler` — typecheck
        + 36 tests.
      - **Mobile (4):** `customers` screen, `check-in-button`, `checkout`
        (`performCheckOut` 26→ + `postCheckout`) — typecheck + 224 tests.
      - **DB (1):** `migrate.main` split into status/baseline/apply handlers.
      Earlier 16 (2026-11-03): `humanize-error`, `tracking-health`,
      `assigned-tasks-reconcile`, `api-client`, `server-api`,
      `new-customer-validation`, `permissions`, `invoice-generate-summary`,
      `invoice-bill-to`, `api.ts`, `settings-bank`, `reports-chart`, `spec.ts`, +
      the three web drilldowns above.
- [x] 21 · components defined inside components (S6478) — done 2026-11-03 (21 → 0):
      hoisted mobile tab icons/buttons (3 layouts) to module scope; hoisted the
      shadcn calendar's Root/Chevron/WeekNumber and memoized a module-scope
      DayButton factory; moved the expenditure chart's tooltip/center-label
      renderers to module-scope factories (useMemo-bound).
- [x] 32 · array index as React key (S6479) — done 2026-11-03 (32 → 0): data lists
      keyed by stable ids/content; fixed-count skeletons map over generated key
      arrays (not the map index); two editable lists (order + market-intelligence)
      got a `uid` like the invoice form (seeds + test fixtures updated).
- [~] 56 · deprecated API usage (S1874) — 51/56 done 2026-11-03: swapped the
      deprecated React `FormEvent` for `SyntheticEvent` across 26 web form files.
      **Deferred (5):** 3× MCP SDK `registerTool` overload + 2× RN
      `@react-native-community/datetimepicker` `onChange` — library-version
      migrations that risk the deployed MCP worker / native picker; revisit with
      an SDK bump.

## Phase 4 — Bulk mechanical smells (~900, batched per area)
- [ ] 476 · props not `readonly` (S6759)
- [ ] 202 · nested ternaries (S3358)
- [ ] TS modernization tail (optional chaining, `replaceAll`, etc.)

## Phase 5 — Coverage (optional)
- [ ] Wire `lcov` into the scan; then gate new code on coverage.
