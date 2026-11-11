# Nice-to-Have Features (deferred)

Low-urgency improvements we've consciously deferred. Unlike the `PENDING-*.md`
specs (which are ready-to-build), these are "someday / if it becomes worth it"
items — often a cost tradeoff or a large project with diminishing returns.

---

## Neon tuning for fewer cold-start / blip surprises

**Deferred 2026-08-21 — cost tradeoff, revisit later.**
From the web-resilience report (rec #6). Three sub-parts:

1. **Always-on minimum compute** — set a small non-zero minimum on the Neon
   compute so the *first* request of the day doesn't pay a scale-to-zero cold
   start (currently the DB sleeps overnight — see the maintenance-window cron
   that gates queries to 08:55–21:05 IST Mon–Sat to keep Neon asleep). This is a
   **paid** setting: keeping compute warm costs money, which is why it's deferred.
2. **Read replica** — add a Neon read replica and point heavy read-only pages at
   it, so a primary hiccup doesn't take down dashboards. Also a cost/complexity
   tradeoff (extra compute + wiring a second connection string).
3. **DB-layer retry-once on transient Neon errors** — the one *code* part: wrap
   `getSqlClient` (apps/api) so a momentary Neon blip is retried once before
   surfacing a 500. This is the natural companion to the auth-lookup retry (#4)
   and the SSR retry (#3), extending "ride out a one-off blip" to *every* query.
   No cost — can be picked up independently of the two paid items above whenever
   we want.

Context: the rest of the resilience report (#1–#5, #7) is already implemented; the
app fails gracefully today (client/SSR timeouts + retries, clear offline-vs-server
messaging + banner, never-drop-writes drafts, DB-blip auth 503, and a `/status`
page with email alerts). See `memory/project-web-resilience-hardening.md`.

---

## Graceful degradation with last-known data (offline read cache)

**Deferred 2026-08-21 — larger project, revisit if outages actually hurt.**
From the web-resilience report (rec #8). Show the last successful reads during a
brief outage (instead of a blank error), with a "showing last synced · HH:MM"
note — the web analogue of the mobile app's offline-first design.

**Decisions already made (2026-08-21) — build to these when picked up:**
- **Storage:** persist to the browser, but with a **24h max-age** and **clear on
  logout** (business/financial data must not linger on shared office machines).
- **Scope:** **all** client-fetched list views (every TanStack Query table).
- **Indicator:** a **per-view inline strip** ("Showing data from last sync ·
  3:42 PM") shown when a view's live refresh fails — not just the global banner.

**Implementation sketch (no new deps needed):**
- Persist per-feature query caches using TanStack Query's built-in `dehydrate` /
  `hydrate` (exported from `@tanstack/react-query` — verified present; avoids
  adding `@tanstack/react-query-persist-client`). New helper
  `src/components/data-table/query-persist.ts`: `restoreClient(client, key)` /
  `persistClient(client, key)` (debounced write on cache change) /
  `clearPersistedCaches()`. Storage key `beyond:qcache:<feature>`, envelope
  `{ t: <ms>, state }`, drop when `Date.now()-t > 24h`.
- Wire it in `src/components/data-table/query-provider.tsx` `withQueryClient`:
  key = `Inner.displayName ?? Inner.name`; **restore in an effect (not the
  useState initializer)** to avoid an SSR/hydration mismatch; return a cleanup
  that stops persisting. Since every list feature is wrapped by `withQueryClient`
  (its own scoped client), this covers all list views by editing ONE file.
- Per-view strip: render a `<StaleDataNotice/>` inside `withQueryClient` (so it's
  inherently per-view). It subscribes to `client.getQueryCache()` and shows the
  strip when an observed query has data AND a populated `state.error` (a failed
  refresh over cached data); "last synced" = max `dataUpdatedAt`. Hides on the
  next successful refetch.
- **Clear on logout:** the logout is a plain server-POST `<form action="/api/auth/logout">`
  in `src/features/settings/settings-page.tsx` (a client component) — convert its
  submit to a small client handler that calls `clearPersistedCaches()` first, then
  POSTs. (Consider clearing `beyond:draft:*` too, though those are unsaved input.)

Report's own caveat: "worth it only if outages are frequent enough to hurt." With
#1–#7 in place the app already fails gracefully, so this has diminishing returns
unless office connectivity is genuinely flaky.

---

## Session control for SUPER_ADMIN (see / revoke logged-in office users)

**Deferred 2026-08-26 — designed, not built. Small-to-medium build; picked up when
session governance actually matters.**

Goal: a SUPER_ADMIN can **see all logged-in office users** and **revoke** a single
session/device **or** force-logout a whole user.

**Scope (decided):** **web office roles only** — MANAGER + ACCOUNTANT (the
self-issued HS256 tokens). SALES_EXECUTIVE / LOGISTICS (mobile) are **out** — the
field app is offline-first and must not depend on an online session check.
SUPER_ADMIN itself stays on Neon Auth (its sessions are managed there).

**Approach (decided): native session store — NOT a Neon Auth migration.**
Moving all auth to Neon Auth was rejected: it fights the offline-first mobile
requirement, breaks the SA-sets-and-hands-over password model, is a large
migration onto an in-transition (Beta) platform, and isn't needed to get session
control. Also rejected: user-epoch-only (can't revoke ONE device, no "who's
logged in" list), OAuth-style short access + refresh tokens (real client refactor,
overkill for ~a dozen office users), and a Cloudflare KV blocklist (over-engineered
at this scale).

**Design (the "best" version we settled on):**
1. **`user_sessions` table** — `id` (the token's `sid`), `user_id`, `role_code`,
   `created_at`, `last_seen_at`, `user_agent`, `ip`, `revoked_at`, `revoked_by`.
   Powers the "who's logged in" list + **per-session revoke** (mark the row).
2. **`sessions_revoked_at` epoch column on `users`** — reject any token whose
   `iat` is older than it. Gives a **bulletproof force-logout-a-user** that also
   kills pre-feature/untracked tokens (which carry no `sid`). Force-logout-user =
   bump the epoch; revoke-one-device = mark the row.
3. **`sid` claim in the HS256 token** (`jwt-issue.ts`) — issued at login for
   MANAGER/ACCOUNTANT only; the sliding-refresh re-issue must **preserve the same
   `sid`** so revocation keeps working across refreshes.
4. **Enforcement folded into the EXISTING cached auth lookup**
   (`middleware/auth-profile.ts` `resolveProfileResilient`) — add `revoked_at` +
   the user epoch to that already-cached (10s TTL), blip-resilient query. Result:
   **zero extra per-request DB round-trips**, revocation effective within **≤10s**
   (the cache TTL), and it inherits the existing "serve stale on a DB blip instead
   of locking people out" resilience. (If truly instant 0s revocation is ever
   wanted, drop the cache for the revoked-flag → one uncached read per office
   request. ≤10s is the recommended default.)
5. **Login** (`routes/auth.ts`) creates the session row (capturing `user-agent` +
   `cf-connecting-ip`) and issues the token with `sid` — for web office roles only;
   mobile login path is unchanged.
6. **Self-logout revokes its own session** so the SA list stays accurate — add a
   `POST /auth/logout` that marks the caller's session revoked (today logout is
   client-only cookie-clear).
7. **SA API + UI** — `GET /sessions` (list active office sessions: name, role,
   device, IP, last-seen, created), `POST /sessions/:id/revoke` (one),
   `POST /sessions/revoke-user/:userId` (all → epoch bump). A SUPER_ADMIN-only
   **Sessions** page under Configure (nav item, `MonitorSmartphone`/`Users` icon).

**Migration-window note:** office tokens issued before this ships carry no `sid`,
so they're untracked until the user next logs in (≤7-day token life). The user
epoch (#2) can still force-logout those users immediately regardless.
