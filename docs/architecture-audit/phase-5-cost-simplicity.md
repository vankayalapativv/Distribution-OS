# Phase 5 — Cost & Simplicity

**Lens:** simplicity and cost are *chosen* characteristics (#5, #6), so complexity that doesn't
serve a prioritized characteristic is a **defect, not neutral** (the book frames every added layer
as a trade-off that must earn its place). Scope: dependencies, dead code, over-engineering, ops
surface, config sprawl.

---

## Headline: the codebase is genuinely lean

The deliberate removals (org scaffolding in 0034/0035; offline code; legacy auth) paid off. On the
dead-code / over-engineering axis this repo is **clean**:

- **API has only 2 runtime dependencies.** Web 30, mobile 48 (Expo apps need many).
- **2 TODO/FIXME markers total; 0 `@deprecated`.** Almost no debt annotations.
- **No references to dropped tables** — the `competitor_`/`branches` grep hits were false positives
  (`competitor_brand` is a live *column*; `branches` was a code comment). No dead-schema code.
- **No significant premature abstraction found** — feature tables checked (`margin_simulations`,
  `filters`, `aging_snapshots`) are all wired to routes/services/dashboard; not half-built.
- **NativeWind is genuinely in use** (163 `className=` files vs 2 `StyleSheet.create`) — its
  build-config presence is real, not vestigial.

So Phase 5 produces few *new* findings; most cost/simplicity issues were already filed in earlier
phases (consolidated below).

---

## New findings (→ gap report)

### G-0501 · Unused dependency `leaflet.markercluster` (web) — Low
Declared in `apps/web/package.json` but **0 references** anywhere in `apps/web` (no static, dynamic,
or side-effect import). Dead weight in the dependency tree (bundle + supply-chain/maintenance
surface). Remove it. A **dependency-hygiene fitness function** (`knip` or `depcheck` in CI) would
prevent this class of drift — proposed under Phase 2 (G-0202).

### G-0502 · Config sprawl / under-documentation — Medium
Code references **28 distinct environment variables** across the apps, but `.env.example`
documents only **6**, and there is no boot-time validation that required vars are present. A new
deployment (or future-you) cannot know the full required config from the repo — a real simplicity
tax and a provisioning risk (ties directly to Phase 3's onboarding cost, G-0302/G-0303). Add a
complete, commented `.env.example` and validate required env at Worker start.

---

## Cost drivers on this stack (the playbook's inventory)

| Driver | Assessment |
|--------|-----------|
| **Neon compute (query volume)** | **The dominant cost lever.** Inflated by the N+1 write loops (G-0401/2/3) and the 2+ uncached auth queries per request (G-0404). Fixing those *directly* cuts Neon compute. |
| Worker CPU time | Low — the hot paths are IO-bound; watch `reports.ts`/`dashboard-metrics.ts` (Phase 4). |
| Request volume | GPS pings (~every 3 min per active SE) + a 3-min cron. Bounded, but the GPS path is where batching (G-0401) matters most. |
| R2 ops | Photos/proofs/attachments — bounded, event-driven. |
| KV / Cache | None in use — the one place a cache *would* pay off is auth/permissions (G-0404). |

**Net:** the cheapest way to lower running cost is not to remove features — it's to **cut query
count** (batch the N+1s, cache per-role permissions). Those are already filed as Phase 4 rows.

---

## Cost/simplicity items already filed in earlier phases (consolidated view)

These are the substance of "cost & simplicity" for this repo; they live under their originating
phase to avoid duplicate rows:

- **G-0102** — `packages/shared` is an empty, unused package (dead module). *(simplicity)*
- **G-0304** — `setup.ts` is broken/stale (writes a dropped column) — dead/broken code. *(simplicity)*
- **G-0405** — redundant duplicate indexes — write/storage cost. *(cost)*
- **G-0404** — uncached per-request auth queries — Neon compute cost. *(cost)*
- **G-0401/0402/0403** — N+1 write loops — Neon compute cost + latency. *(cost)*
- **G-0303/0302** — manual migrations & provisioning; hardcoded config — operational burden. *(simplicity/ops)*
- **G-0105** — mobile `lib/` 178-file flat dir — navigational simplicity. *(simplicity)*
- **G-0104** — god-files in services — maintainability/simplicity. *(simplicity)*

---

## Operational burden (solo-dev simplicity tax)

- **Deploy:** wrangler deploy (API) + OpenNext (web) + EAS (mobile) — three separate pipelines,
  only one automated in CI (mobile release).
- **Migrations:** manual `psql -f`, one file at a time, no runner/tracking, on a **shared prod+dev
  DB** (G-0303). Highest per-change simplicity tax.
- **Onboard a client:** currently requires code edits (G-0302) — the single biggest ops cost.
- **Config:** 28 env vars, 6 documented (G-0502).

---

## Coverage (ledger) update

Reviewed & marked `[x]`: `packages/db/src/seed-dev.ts`, `apps/mobile/babel.config.js` is not in the
ledger (config). Dependency manifests and `.env.example` reviewed (non-ledger). No new source files
required deep reads beyond those already marked; Phase 5 was primarily manifest/config/schema
analysis.
