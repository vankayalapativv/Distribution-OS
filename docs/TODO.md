# TODO / Deferred backlog

Small, deferred to-dos that don't yet warrant a full `PENDING-*.md` spec. Newest first.

---

## Add "Change password" option to the WEB app for SA, Manager, Accountant

**Added:** 2026-08-18 · **Status:** not started

The **mobile** app already has a working self-service change-password flow
(`Settings → Account → Change password` → `POST /me/change-password`). The **web**
dashboard has no equivalent UI for the office roles. Add one.

**What exists to build on:**
- API endpoint `POST /me/change-password` ([apps/api/src/routes/me.ts](../apps/api/src/routes/me.ts))
  already works for **any** authenticated role (`requireAuth`): it verifies
  `currentPassword` against the account's `password_hash`, then writes the new hash.
  Body: `{ currentPassword, newPassword }` (min 8 chars). No web UI calls it yet.

**Per-role nuance to resolve:**
- **MANAGER / ACCOUNTANT** — authenticate on web via our own HS256 JWT backed by
  `users.password_hash`, so `POST /me/change-password` works for them **as-is**;
  they just need a web form (Settings/profile page).
- **SUPER_ADMIN** — on web, SUPER_ADMIN authenticates via **Neon Auth** (external
  RS256 provider), so their web password may be managed by Neon Auth, not our
  `password_hash`. Note that SA accounts DO carry a local `password_hash` too (that's
  what mobile login uses). Decide: route web SA password changes through Neon Auth's
  own flow, or reuse `POST /me/change-password` against the local hash (keeps mobile +
  web in sync but may diverge from the Neon Auth credential). Confirm with the product
  owner before building.

**Scope:** a "Change password" form on the web settings/profile area for the three
office roles, wired to `POST /me/change-password` (with the SA decision above).
