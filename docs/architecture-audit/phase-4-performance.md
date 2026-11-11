# Phase 4 — Performance & Responsiveness

**Lens:** performance is an operational characteristic (Ch. 4); on serverless, latency and cost
are tied, so this overlaps Phase 5. Focus: N+1 over Neon's HTTP driver, driver correctness,
pagination/unbounded sets, Worker CPU/subrequest limits, caching, indexes, frontend bundles.

Method: import-graph + a loop/`await sql` N+1 scanner over all 68 service files, live-DB index
inspection, and targeted reads of the hot paths.

---

## Summary scorecard

| Dimension | Verdict |
|-----------|---------|
| DB driver | ✅ `@neondatabase/serverless` `neon()` (HTTP) — correct for Workers; no long-lived-pool driver in the Worker path |
| Index coverage | ✅ Strong — **210 indexes** live; hot columns (gps_points session/user+time, orders/collections customer) covered |
| Pagination | ✅ Mostly — 38/68 services use LIMIT/pagination; web uses server-side paging (pageSize 8) + code-splitting |
| **N+1 write loops** | ❌ **Real** — order items, GPS points, and collection reconciliation each insert one-row-per-round-trip |
| Per-request auth cost | ⚠️ ~2+ uncached DB round-trips per request (profile + permissions) |
| Redundant indexes | ⚠️ Duplicate indexes on several tables (write/storage cost) |
| Caching layer | ➖ None (no KV/Cache API) — fine except for the per-request auth lookups |

---

## What's good (record it)

- **Correct serverless driver** everywhere in the Worker path (`lib/db.ts` → `neon()`); the
  non-serverless `postgres` package is confined to `packages/db` tooling, never the Worker.
- **Indexes are a strength:** 210 live indexes; every hot query path spot-checked has a covering
  index (`gps_points_session_recorded_at`, `gps_points_user_recorded_at_desc`, `orders_customer`,
  `collections_customer`, heartbeat session/captured, dwell session).
- **Read paths paginate:** the web uses **server-side pagination (pageSize 8)** and `next/dynamic`
  code-splitting (per app conventions); most list services apply LIMIT.

## Findings (→ gap report)

### G-0401 · N+1 on the hottest write path — GPS point ingestion — High
`services/tracking-sessions.ts:337` — `for (const point of input.points) { await sql INSERT }`.
GPS batches (the mobile buffers points and uploads arrays) insert **one round-trip per point**
over Neon's HTTP driver. This runs for **every field executive, all day, every ~3 min** — the
system's highest-frequency write. A 20-point batch = 20 sequential HTTP inserts (latency stacks;
counts against the Workers subrequest budget). Fixable: validate/filter in JS, then a **single
multi-row `INSERT … VALUES (…),(…) … ON CONFLICT DO NOTHING RETURNING location_point_id`**, and
diff the returned ids to mark duplicates. *AGENTS.md's own rule: "batch DB writes into one
set-based statement — never one round-trip per row."*

### G-0402 · N+1 (and non-atomic) order line-item inserts — Medium
`services/orders.ts:1365–1413` — three sequential loops insert oil, bearing, and filter line
items with individual `await sql` INSERTs (outside the `sql.transaction([...])` used elsewhere in
the file at 1535/1675/1754). A 15-line order = ~15 round-trips, and a mid-loop failure leaves a
**partial order** (atomicity — cross-ref Phase 6). Fix: build one multi-row INSERT per item kind
and include them in the order's `sql.transaction` batch — fixes N+1 **and** atomicity together.

### G-0403 · N+1 on the money path — collection reconciliation — Medium
`services/collections.ts:909` — `for (const a of allocations) { await sql INSERT; await apply… }`
(2 round-trips per allocation), and `reReconcileCustomer` (`:951`) does
`for (const c of verified) await reverseCollectionAllocations(...)` (nested N+1). The code comment
already flags "heavy … mind the Workers subrequest budget." Lower frequency (admin verify action)
than G-0401, but on financial writes. Batch allocations into set-based statements within the
existing transaction.

### G-0404 · Uncached per-request auth/permission lookups — Medium
Every request runs `attachAuthContext` → `profileByAppLoginId` (1 query) and every protected route
runs `effectivePermissionsForRole` (`lib/authz.ts`) — **2+ DB round-trips before the handler**,
uncached, though role→permission mappings change rarely. On Neon's HTTP driver this is pure
per-request latency + cost. Cache per-role permissions (Cache API/KV, or an in-isolate memo with a
short TTL). *Ties to cost (#5) and performance (#3).*

### G-0405 · Redundant duplicate indexes — Low
Live DB shows duplicate indexes on the same columns: `collections_customer` **and**
`idx_collections_customer`; `orders_customer` **and** `idx_orders_customer`; and three overlapping
`gps_points` user+time indexes (`gps_points_user_recorded_at_desc`, `…_key`, `idx_gps_points_user_time`).
Duplicates add write amplification and storage (cost #5) with no read benefit. Drop the redundant
ones after confirming query plans. *(Also a Phase 5 cleanup item.)*

---

## Not found / not measured (honest scope)

- **No unbounded-result smoking gun** confirmed — the 30/68 services not using LIMIT are mostly
  single-row/aggregate reads, not list endpoints. A per-endpoint pagination audit can be a Phase-2
  fitness function rather than a manual sweep.
- **Frontend bundle sizes not measured** — requires a production build; proposed as a bundle-size
  fitness function in Phase 2 (G-0202) rather than asserted here.
- **Worker CPU / large-JSON serialization:** no obvious unbounded synchronous compute found in the
  hot paths reviewed; the report/analytics services (`reports.ts` 737 LOC, `dashboard-metrics.ts`
  716) are the places to watch and are better covered by a query-count/CPU fitness function.

---

## Coverage (ledger) update

Reviewed & marked `[x]` this phase: `apps/api/src/lib/db.ts` (already), `services/tracking-sessions.ts`,
`services/orders.ts` (already), `services/collections.ts` (already), `lib/authz.ts` (already).
Newly marked: `services/tracking-sessions.ts`. N+1 scanner output retained in scratchpad.
