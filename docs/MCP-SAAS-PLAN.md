# Distribution OS — Per-Enterprise MCP in the SaaS

> **Status: PLANNING ONLY — no code.** How the deployed read-only MCP server (`apps/mcp`, Cloudflare Worker `distribution-os-mcp`) becomes multi-enterprise. Companion to [`SAAS-PLAN.md`](SAAS-PLAN.md) (this is **Phase 4**). **All findings from the actual code (2026-11-11), not memory.** Locked decisions: **RLS-forced raw SQL** (keep `run_sql`) + **MCP is in the SaaS build** (not deferred).

## What the code does today (grounded)

| Area | Current code | SaaS impact |
|------|-------------|-------------|
| **Auth** | `auth.ts` — a **single shared passphrase** gates `/authorize`; on success mints an OAuth session hardcoded to **`userId: "distribution-os-owner"`**. `scope = mcp:read`. | ⚠️ **No per-enterprise identity.** Must become per-enterprise credential → `props.enterpriseId`. |
| **Config** | `ConfigDO` (singleton `idFromName("config")`) holds `{ enabled, passphrase }`, set from web **Settings → MCP**. | ⚠️ Becomes **per-enterprise** config (one record per `enterprise_id`): own enable flag + own passphrase. |
| **SQL** | `run_sql` takes **arbitrary raw SQL** (`z.string()`) → `runReadOnlySql(REPLICA_DATABASE_URL, query)` on the Neon **read replica**. Read-only enforced physically by the replica. | ⚠️ **Nothing scopes rows today** — the #1 isolation risk. Needs RLS + per-request GUC. |
| **Tools** | `run_sql`, `get_audit_log`, `render_map` (map also reads the replica via `getOperatingArea`). | ⚠️ All three must run under the caller's `enterprise_id`. |
| **Connection** | Single `REPLICA_DATABASE_URL` secret; `neon()` HTTP driver, single-statement `sql.query`. | ⚠️ Must connect as a **non-superuser role with RLS forced**, and set the GUC per query. |

## Locked design (2026-11-11)

### 1. RLS-forced raw SQL — keep `run_sql`, make it safe

The model keeps writing free-form `SELECT`s, but **Postgres RLS physically filters every row** to the caller's enterprise:

- **Dedicated low-privilege DB role** for the MCP connection (NOT a superuser / table owner — RLS does not apply to those unless `FORCE`d). Use `ALTER TABLE … FORCE ROW LEVEL SECURITY` + a policy `USING (enterprise_id = current_setting('app.enterprise_id')::uuid)` on every enterprise-scoped table (the same RLS layer the whole app uses — `SAAS-PLAN.md` §1).
- **Per-query GUC:** before each statement, `set local app.enterprise_id = '<caller enterprise>'` inside a transaction, then run the model's SQL. The `enterprise_id` comes from the **OAuth session props** (`props.enterpriseId`), never from the model's input — so the model cannot widen its own scope. (Neon HTTP driver: run the `set local` + query as one `sql.transaction([...])` so the GUC and the query share a session.)
- **Replica caveat:** RLS works on a read replica (policies replicate), but confirm the low-priv role + `app.enterprise_id` GUC are settable on the replica endpoint. If the replica only allows the owner role, point the MCP at a scoped reader on the primary instead.
- **Defence in depth:** the Phase-6 **cross-enterprise leak tests** must include an MCP path — spin up two enterprises, connect as A, attempt `select * from invoices` / `customers` / `collections`, assert zero B rows.

### 2. Per-enterprise credential + identity

- Each enterprise gets its **own MCP passphrase** (shown in *their* Settings → MCP, same UX as today — passphrase-in-the-UI is by design, memory `mcp-settings-page`), stored in their per-enterprise config record.
- `/authorize` resolves the submitted passphrase → the **owning `enterprise_id`**, and completes the OAuth authorization with `props: { enterpriseId }` (replacing the hardcoded `"distribution-os-owner"`). Every tool call then reads `enterpriseId` from props.
- **Endpoint:** one shared worker + `/mcp` is fine (the passphrase already disambiguates the enterprise); no per-enterprise subdomain needed. The enterprise adds it as a custom connector exactly as today.
- **Enable switch stays per-enterprise:** the master `enabled` flag becomes per-enterprise, so an enterprise (or the platform owner) can turn their own connector off.

### 3. Audit + map, scoped

- `get_audit_log` and the audit DO writes are **keyed by `enterprise_id`** — an enterprise sees only its own query history.
- `render_map` / `getOperatingArea` run under the same GUC, so the derived operating area is the enterprise's own data only.

## Build notes (Phase 4, in the SaaS build)

- Depends on the Phase-2 RLS layer existing first (the MCP reuses it — it does **not** invent its own scoping).
- The risky part is **not** the SQL tool itself but guaranteeing the low-priv role + forced RLS + GUC are airtight; gate go-live on the MCP leak test passing.
- `.dev.vars` / secrets gain the scoped reader URL; `ConfigDO` migrates from a singleton to per-enterprise records.

## Open items (flagged, not blockers)

1. **Replica vs primary for the scoped reader** — confirm the forced-RLS low-priv role can set `app.enterprise_id` on the Neon read replica; fall back to a scoped reader on the primary if not.
2. **Write-safety belt-and-braces** — read-only is already physical (replica), but the low-priv role should also be `GRANT SELECT`-only, so even a mis-pointed URL can't write.
3. **Rate limiting per enterprise** — the row cap (5000) + 15s timeout exist; consider a per-enterprise query-rate cap so one enterprise's MCP can't hammer the shared replica.
