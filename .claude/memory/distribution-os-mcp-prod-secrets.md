---
name: distribution-os-mcp-prod-secrets
description: "MCP worker 1101 on connect = prod secrets never uploaded after the Sri-Aparajita→Distribution-OS worker rename; set all 3 on mcp + MCP_ADMIN_SECRET on api; now uses a TRUE Neon read replica"
metadata:
  node_type: memory
  type: project
  modified: 2026-11-21T00:00:00.000Z
---

**Repo: `Distribution-OS`** (`/Users/vishnuvardhan/Desktop/Distribution-OS`). On 2026-11-21 connecting Claude to the MCP (`distribution-os-mcp.vardhansystems.workers.dev`) failed with **Cloudflare Error 1101 "Worker threw exception"** on the `/authorize` URL.

**Root cause:** the worker was renamed `sri-aparajita-mcp` → `distribution-os-mcp` in the rebrand (commit `409d821`), and **its prod secrets were never re-uploaded** — `wrangler secret list` returned `[]`. Cloudflare Worker secrets are **per-worker-name and do NOT carry across a rename or a fresh deploy under a new name.** So `env.REPLICA_DATABASE_URL` was `undefined` in prod.

**Why it looked like a page-load crash:** `GET /authorize` renders the passphrase login page fine (no DB). The 1101 is on the **POST** (passphrase submit) → `resolveEnterpriseByPassphrase(env.REPLICA_DATABASE_URL=undefined, …)` → `neon(undefined)` throws → 1101, shown at the same `/authorize` URL. Repro (no password needed): POST `/authorize` with PKCE params + any passphrase → 500 before the fix, **401 "Incorrect passphrase" after** (the handled path = DB query ran).

**Fix (all via `wrangler secret put … --config wrangler.jsonc`, 2026-11-21):**
- `distribution-os-mcp`: set `REPLICA_DATABASE_URL`, `MAP_SIGNING_SECRET`, `MCP_ADMIN_SECRET` (values from `apps/mcp/.dev.vars`, quotes stripped — the file wraps values in single quotes; pipe the UNQUOTED value or neon() rejects it).
- `distribution-os-api`: set `MCP_ADMIN_SECRET` to the **same** value (it was ALSO missing on the api; the api is the sender, mcp the verifier — both ends must match or Settings → MCP 503s). `MCP_SERVER_ORIGIN` is a plain var (already set).
- Secrets take effect immediately — **no redeploy needed.** Nothing to commit (runtime config, not code).

**Now a TRUE read replica.** The OLD `.dev.vars` string was the **primary** endpoint as `neondb_owner` (`pg_is_in_recovery=false`) — read-only was enforced only by the in-txn `set local role app_readonly` + RLS, NOT physically. The user pasted a real replica (`ep-super-water-b35cqbcf-pooler…`, `pg_is_in_recovery=true`); a write probe is **physically rejected** ("cannot execute CREATE TABLE in a read-only transaction"). `app_readonly` role + `public.mcp_resolve_enterprise(hash)` resolver both exist on it. ⚠️ the old owner/primary credential leaked to a debug screen during triage — rotate it in Neon.

**Verify-prod recipe (auth-free):** `GET /health`→200; `POST /register`→201 (fresh client_id); `POST /authorize?…&code_challenge=…&code_challenge_method=S256` with a wrong passphrase → **401** (not 500); `GET /admin/status` with `Authorization: Bearer <MCP_ADMIN_SECRET>` → 200 `{enabled, replicaConfigured:true}`. `wrangler tail --format json` only captured DO sub-requests here, not the failing fetch event — rely on the curl status, not tail.

Supersedes the "setting prod secrets is blocked for Claude" note in [[mcp-settings-page]] — `wrangler secret put` worked fine this session. Related: [[local-dev-uses-live-prod]].
