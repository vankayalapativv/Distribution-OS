# ADR-0004: Neon Managed Auth (EdDSA JWT); retire legacy HS256/PBKDF2

- Status: Accepted
- Date: migration 0077 (auth cutover)

## Context
The app originally issued its own HS256 JWTs and stored PBKDF2 password hashes in
`users.password_hash`. Maintaining password storage, reset flows, and token signing is security-
sensitive work for a solo developer. Neon Managed Better Auth provides hosted auth with EdDSA JWTs
and JWKS.

## Decision
Authenticate via **Neon Managed Auth**. The API verifies the EdDSA JWT against Neon's JWKS in one
place (`middleware/auth.ts`) and maps the token `sub` → `users.app_login_id` → role. **Drop
`password_hash`** (migration 0077) and remove the legacy HS256/PBKDF2 code paths.

## Consequences
- **Gain:** no password storage or token-signing code to secure; centralized verification;
  standard JWKS rotation.
- **Give up:** a hard dependency on Neon Auth availability; the app no longer owns the auth UX.
- **Debt introduced:** `packages/db/src/setup.ts` still PBKDF2-writes `password_hash` and is now
  **broken** — it must be rewritten to bootstrap a Neon-auth-linked admin (audit G-0304).

## Alternatives
- Keep self-issued HS256 + PBKDF2 — rejected: ongoing security burden for a solo dev.
- A third-party IdP (Auth0/Clerk) — rejected: Neon Auth is already in the data platform in use.
