---
name: dev-sqlite-busy-recovery
description: Startup SQLITE_BUSY/READONLY from next dev was missing initOpenNextCloudflareForDev() — fixed in next.config
metadata:
  node_type: memory
  type: reference
  originSessionId: 99136f55-afbb-4798-93c6-8484f10b5e00
  modified: 2026-10-01T13:43:48.168Z
---

At `pnpm dev` startup the web server printed workerd fatals (then self-recovered):
`SQLITE_BUSY_RECOVERY` / `database is locked: SQLITE_BUSY` / `attempt to write a
readonly database: SQLITE_READONLY` (tagged `@sri-aparajita/web:dev`), plus an
occasional API `Workers runtime canceled this request … code had hung`.

**Root cause (fixed 2026-10-01, commit `a10d7db`):** `apps/web/next.config.ts`
did NOT call `initOpenNextCloudflareForDev()`, yet the app uses
`getCloudflareContext()` (`src/lib/server-api.ts`) and `@opennextjs/cloudflare`.
Without that init, each `getCloudflareContext()` in `next dev` spins up its OWN
miniflare; Next renders routes concurrently, so several `workerd` ended up
racing on the same `.wrangler/state/v3/cache` SQLite → the BUSY/READONLY fatals.
Confirmed via `lsof` (two workerd holding the same `metadata.sqlite`).

**Fix:** add to `next.config.ts` (top level, not awaited):
`import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";`
`void initOpenNextCloudflareForDev();`
It gives ONE shared dev miniflare (verified: web then runs a single workerd),
no-ops for `next build`/prod. Startup is clean, app serves 200s.

**Dead ends / notes:**
- An earlier `predev` cache-wipe (`scripts/reset-dev-cache.mjs`) only treated the
  symptom and actually surfaced the READONLY variant — reverted.
- Also seen: TWO `pnpm dev` trees running at once on the same repo (a stale one
  not fully killed) — same-repo `.wrangler` contention. Fully kill dev before
  restarting; `.wrangler` is gitignored.
- The API "hung request" was a workerd cold-start deadline, not a lock; gone once
  the web race was fixed.

Related: [[local-dev-uses-live-prod]].
