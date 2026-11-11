# Neon Auth Migration Plan — all authentication → Neon Managed Better Auth

**Status:** planned (2026-09-15). Scoped to authentication only; composes with the Sri Aparajita re-client + repo-split threads.
**Driver:** kill the split-brain (custom HS256 + PBKDF2 password store vs legacy Neon/Stack Auth for SUPER_ADMIN) → **one identity system: Neon Managed Better Auth**, web **and** mobile.

This is a **fresh instance** (Sri Aparajita, empty DB). So there is **no user-data migration** — we build the new auth and seed fresh, then delete the old code paths. "Migration" here = replace the auth implementation, not move accounts.

---

## Decisions locked (from Q&A)

- **One credential store:** Neon Better Auth `neon_auth` schema is the sole source of truth. Delete `users.password_hash` (PBKDF2) and the custom HS256 login/mint entirely.
- **Web (Next.js, SUPER_ADMIN/MANAGER/ACCOUNTANT):** Neon Auth directly — official Next.js server SDK, HttpOnly session cookie, **email/password only** (no OAuth).
- **Mobile (Expo, SALES_EXECUTIVE/LOGISTICS):** **pure Neon Auth** (offline-first is dropped). App signs in via Neon Auth's **REST API** (email/password) → short-lived EdDSA JWT + refresh → `expo-secure-store` → Bearer to the Hono API → API verifies via JWKS. No custom token. Requires connectivity to log in/refresh.
- **API (Hono/Workers):** verifies the Neon Auth **EdDSA (Ed25519)** JWT via **JWKS**; resolves the app role from the `users` table (Neon JWTs carry no custom claims).
- **Provisioning:** **admin-only** via the Admin plugin `admin.createUser({ email, password, name, role })`; **public sign-up endpoint gated** (Neon can't natively disable signup yet).
- **Handover model (decided):** **password reset + edit the person's details** (name/phone/email) and the **new executive/logistics person keeps the old one's data** — account is reused, NOT deleted or re-created. No `banUser` for handover.
- **Session management (decided — new feature):** the super-admin can **view and revoke each user's active sessions** (Admin plugin `listUserSessions` / `revokeUserSession` / `revokeUserSessions`). Handover therefore = reset password + update details + **revoke the departing person's sessions** so their logged-in devices are kicked. This replaces the deactivation question — reuse + session-revoke is the clean path.
- **Shared field accounts:** kept (one Neon Auth user = the shared field login) — moving to per-person would ripple through all by-account attribution (created_by / sales_executive_id / collected_by_user_id / GPS user_id / targets / leaderboard / dues); revisit later.
- **Sequencing (decided):** **web auth first** (lowest risk), then mobile auth (+ the offline-removal work) — see [OFFLINE-REMOVAL-PLAN.md](OFFLINE-REMOVAL-PLAN.md). Separate branches.
- **Feasibility accepted:** Better Auth is Beta, AWS-only, incompatible with IP Allow/Private Networking. Project + Auth already enabled; keys in root `.env`.

---

## Current state (what we're replacing)

- **API** (`apps/api/src`): dual auth in `middleware/auth.ts` — path 1 legacy Neon/Stack Auth **RS256** via JWKS (`lib/jwt-auth.ts`, `verifyAuthToken`, env `AUTH_AUDIENCE`/`AUTH_ISSUER`/`AUTH_JWKS_URL`), profile by `users.app_login_id`; path 2 own **HS256** (`lib/jwt-issue.ts`, issuer `beyond-distribution`, `JWT_SECRET`), profile by `users.id`. `routes/auth.ts` `/auth/login` verifies email+password (`lib/password.ts`, PBKDF2 100k SHA-256) and issues HS256. `middleware/auth-profile.ts` resilient profile cache (10s TTL). `lib/authz.ts` role/permission checks. Sliding-session refresh via `X-Refresh-Token`.
- **Web** (`apps/web/src`): `beyond_auth` HttpOnly cookie (JWT), `features/auth/server-session.ts` reads it, `features/auth/auth-role.ts` gates, `app/api/auth/login|logout` BFF routes, `app/auth/redirect`.
- **Mobile** (`apps/mobile/src`): `lib/auth-actions.ts` login (role gate SE/LOGISTICS/SUPER_ADMIN), Bearer token in `lib/auth-storage.ts` (expo-secure-store), `components/auth-gate.tsx` role routing, `lib/api-core.ts` base URL.
- **Data:** `users.app_login_id text` (`0001`, indexed `0002`) — the identity-mapping column to Neon Auth `sub`. Currently only SUPER_ADMIN has it populated.
- **Env today:** API reads `AUTH_JWKS_URL`/`AUTH_AUDIENCE`/`AUTH_ISSUER`/`JWT_SECRET`. Root `.env` now has `NEON_AUTH_BASE_URL` + `NEON_JWKS_URL`. `.env.example` names `AUTH_JWKS_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `NEXT_PUBLIC_NEON_AUTH_LOGIN_URL`.

**⚠ Env naming mismatch to fix first:** root `.env` = `NEON_JWKS_URL`, but API code = `AUTH_JWKS_URL`. Pick one name (recommend `NEON_JWKS_URL` + `NEON_AUTH_BASE_URL`) and align code + `.env.example` + wrangler secrets.

---

## Target architecture

```
        email + password
Web ───────────────────────▶ Neon Better Auth (neon_auth schema)  ── issues EdDSA JWT + HttpOnly cookie
Mobile ── REST sign-in ─────▶      (sole credential store)             + short-lived access token (+refresh)
   │                                        │ JWKS (/.well-known/jwks.json)
   │  Bearer: Neon JWT                      ▼
   └────────────────────────▶ Hono API (Workers): verify JWT via JWKS ──▶ resolve role from users.app_login_id
                                                                          ──▶ business logic (unchanged)
```

- Neon owns *identity + credentials*. The `users` table owns *app role + business profile*, joined on `app_login_id = jwt.sub`.
- Authorization (roles, `section:*`/`action:*` permissions, SE data-scoping) stays exactly as today — only the *authentication* front-end changes.

---

## Phase 0 — Config & foundation

1. **Align env names** (above). Set on all three surfaces: API (`wrangler secret put NEON_JWKS_URL`, `NEON_AUTH_BASE_URL`), web (`.env.local` + deployed worker), mobile (`EXPO_PUBLIC_NEON_AUTH_BASE_URL` in `eas.json`/`.env`).
2. **Register trusted domains** (the `neon` skill gotcha — redirects fail otherwise): `neon neon-auth domain add <web-prod-domain>`, `… allow-localhost`, and any preview domains. Email/password mobile (no redirect) needs none, but web does.
3. **Confirm the JWKS + issuer values** from the Neon console / `neon env pull`; verify `GET <NEON_AUTH_BASE_URL>/.well-known/jwks.json` returns the Ed25519 keys.
4. **Production checklist:** walk `https://neon.com/docs/auth/production-checklist.md`.

## Phase 1 — API: verify Neon JWTs (additive, non-breaking)

Goal: the Hono API can authenticate a request from a Neon Auth JWT, *alongside* the current auth (so nothing breaks mid-migration).

1. New `lib/neon-auth.ts`: verify an EdDSA JWT against `NEON_JWKS_URL` (reuse the `jose` `createRemoteJWKSet` pattern already in `lib/jwt-auth.ts`; algorithm `EdDSA`). Return `{ sub, email }`.
2. `middleware/auth.ts`: add a branch that, on a Neon-issued token, verifies via `lib/neon-auth.ts` and resolves the profile by `users.app_login_id = sub` (the resilient `auth-profile.ts` cache stays — just swap the lookup key). Keep the existing HS256 path temporarily.
3. Tests mirroring `auth.refresh.test.ts` / `auth-profile.test.ts` for the Neon path.

## Phase 2 — Data model: identity mapping for ALL roles

1. Generalize `users.app_login_id` to hold every user's Neon Auth `sub` (not just SUPER_ADMIN). No new column needed; add a **NOT-EXISTS/UNIQUE** consideration: a new migration `00xx_users_neon_identity.sql` adding a partial UNIQUE index on `app_login_id where app_login_id is not null`.
2. Provisioning writes both: `admin.createUser(...)` in Neon → capture the returned Neon user id → insert/update the `users` row with `app_login_id = <that id>` + role. (Two-system write; wrap so a failure in either is surfaced, not half-applied.)
3. Since the DB is fresh, there is **no backfill** — every account is created through the new path from day one.

## Phase 3 — API: cut over & delete the old auth

1. **Provisioning endpoints** (`routes/super-admin.ts`): `POST /super-admin/users` and `POST /super-admin/users/:id/password` now call Neon `admin.createUser` / password-set instead of writing `password_hash`. `PATCH` (edit name/phone/email) stays — this IS the handover path (reuse the account, new person keeps old data). **New: session-management endpoints** — `GET /super-admin/users/:id/sessions` (`listUserSessions`) + `POST /super-admin/users/:id/sessions/revoke` (`revokeUserSessions`) so an admin can see and kick a user's logged-in devices (used on handover).
2. **Remove** `routes/auth.ts` `/auth/login` (custom login), `lib/jwt-issue.ts` (HS256 mint), `lib/password.ts` (PBKDF2), the HS256 branch + sliding-refresh in `middleware/auth.ts`, and the `JWT_SECRET`/`AUTH_AUDIENCE`/`AUTH_ISSUER` legacy env once nothing references them.
3. **Gate public sign-up:** ensure the app never calls Neon's public `/sign-up/*`; if the Neon Auth base is reachable from clients, block/return 404 for sign-up routes at the edge (web middleware / API) so only `admin.createUser` creates accounts.
4. Keep `lib/authz.ts`, `services/permissions.ts`, and SE `assertCustomerVisible` scoping **unchanged**.

## Phase 4 — Web (Next.js): Neon Auth login

1. Install + wire the **Next.js server SDK** (`@neondatabase/auth/next/server`) + client (`@neondatabase/neon-js/auth`). Configure with `NEON_AUTH_BASE_URL` + `NEON_AUTH_COOKIE_SECRET`.
2. Replace `app/login` + `app/api/auth/login|logout` with the Neon Auth session flow (email/password). `features/auth/server-session.ts` reads the Neon session instead of the `beyond_auth` cookie; `features/auth/auth-role.ts` unchanged (role still from the API/`users`).
3. The API calls the web makes now send the **Neon JWT** (from the session) as Bearer — `serverApiFetch` swaps the token source.
4. **Super-admin Users & Teams page** (`/settings/users`): "Add user" + "Set password" call the API provisioning endpoints (which now hit `admin.createUser`). Wording stays "Set password" (still can't read back). **Add a per-user "Sessions" view** (list active sessions + "Sign out all devices" → revoke) for the handover flow.
5. Remove `beyond_auth` cookie plumbing.

## Phase 5 — Mobile (Expo): pure Neon Auth via REST

1. `lib/auth-actions.ts`: `login(email, password)` → POST to Neon Auth's REST **sign-in/email** endpoint (`<NEON_AUTH_BASE_URL>/...`) → receive access JWT (+ refresh/session). Keep the role gate (reject non SE/LOGISTICS/SUPER_ADMIN).
2. `lib/auth-storage.ts`: store the Neon access + refresh tokens in `expo-secure-store` (replacing the custom Bearer).
3. Refresh: when the 15-min access token nears expiry (or on a 401), call the Neon refresh/`token()` endpoint; on refresh failure → route to login. Add a small token manager (`lib/neon-session.ts`).
4. `lib/api-core.ts`: send the Neon JWT as Bearer to the Hono API.
5. **Remove offline-auth remnants:** the app no longer needs to authenticate offline. Session persistence stays (SecureStore), but drop any "works offline without a valid token" assumptions in `auth-gate.tsx`/`use-auth-gate.ts`. (Note: the offline *data* sync engine is a separate concern — this plan only changes auth. Confirm scope before touching sync.)
6. No official Better Auth Expo SDK → this is hand-wired REST (documented, straightforward). No redirect/deep-link → no trusted-domain registration needed for mobile.

## Phase 6 — Seed, cutover, verify

1. **Bootstrap the first SUPER_ADMIN** on the fresh Neon project (console admin-create, or a one-off script) so an admin exists to provision the rest. Insert the matching `users` row with `app_login_id = sub` + SUPER_ADMIN role.
2. Verify end-to-end per surface: web login (all 3 office roles) → API 200 with Neon JWT; mobile login (SE + LOGISTICS) → API 200; admin creates an SE via the web page → that SE can log into the app; `banUser` blocks login; role resolution + SE scoping intact; public sign-up blocked (404).
3. Delete any test identities after.

## Rollback

- Phases 1–2 are additive (dual auth) → safe. The point of no return is Phase 3 (deleting HS256/PBKDF2). Keep the old code on a branch; a fresh instance with no real users means rollback = redeploy the pre-cutover build + re-enable the old env. Take a `pg_dump` before Phase 3 regardless.

---

## Open items I need from you (before/while building)

1. **Exact Neon Auth values:** confirm `NEON_AUTH_BASE_URL`, the JWKS URL, and the issuer/`aud` the JWTs carry (so JWKS verification matches). I'll read them from `.env` / `neon env pull`.
2. **Neon CLI/console access** for me to: register trusted domains, bootstrap the first admin, and inspect the `neon_auth` schema — or you run those steps and share outputs.
3. **Confirm the REST sign-in endpoint shape** for Better Auth on your project (path + response body) — I'll verify against the live base URL, but a green light to hit it from here helps.
4. **Web SDK package availability** — confirm `@neondatabase/auth` / `@neondatabase/neon-js` install cleanly in the Next.js app (OpenNext/Workers build).
5. **Scope check on mobile offline sync:** this plan touches *auth* only. The data-sync offline engine stays unless you want it removed too — confirm.
6. ~~`banUser` vs status~~ **RESOLVED:** handover = reuse the account (edit person details) + reset password + **revoke sessions** (session management), new person keeps the old data. No `banUser`.
