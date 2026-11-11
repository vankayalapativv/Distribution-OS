# Sri Aparajita MCP Server — Build Spec

> **Status:** Implementation-ready spec. **No code written yet** — build on the owner's go.
> **Last updated:** 2026-08-13
> **Discussion history:** condensed in memory (`project-mcp-server-discussion`). Architecture
> diagram (private): https://claude.ai/code/artifact/1370d792-7b78-434a-b5de-0e16f9b48ddb

A **remote, read-only, OAuth-gated MCP server** that lets the owner + admin ask the Sri Aparajita
lubricant-distribution business questions in natural language from **Claude**, backed by a
single ad-hoc SQL tool over a **read-only Neon replica**. Built as a **Cloudflare Worker** on
the existing stack.

---

## 1. Locked decisions

| Area | Decision |
|---|---|
| Purpose | Natural-language Q&A / analytics over the business. **Read-only.** |
| Consumer | Remote MCP; **Claude first** (claude.ai / Claude Desktop custom connector). |
| Server shape | **New `apps/mcp` Cloudflare Worker** (not `apps/api`). |
| Transport | **Streamable HTTP** via the official TS SDK `createMcpHandler` (stateless, no Durable Objects). |
| Auth | **MCP OAuth** via `@cloudflare/workers-oauth-provider` (CIMD), gated by **upstream Google sign-in**. |
| Allowlist | **`support@vardhansystems.in`** only (add the owner's email later). |
| Query model | **Ad-hoc read-only SQL**, one tool (`run_sql`). Schema discovery via `information_schema`. |
| Data source | **Neon read replica** (already created) — always-current, isolated compute, scales to zero. |
| DB access role | Dedicated **`mcp_readonly` role, `SELECT`-only**. |
| Guardrails | **row cap 5000**, **`statement_timeout` 15s**, audit log per query. |
| Data exposure | **Everything** (full schema + full data incl. customer PII) — owner's own data. |
| Deploy URL | A **`workers.dev` subdomain** (e.g. `sri-aparajita-mcp.<account>.workers.dev`). |
| Cost profile | Workers ~$0–5/mo; replica compute scales to zero (idle = ~$0); no extra storage. |

---

## 2. Architecture

```
support@vardhansystems.in  ──► Claude ──(OAuth 2.1, Google sign-in)──►  apps/mcp Worker  ──SELECT──►  Neon read replica
   (custom connector)          MCP host   workers-oauth-provider (CIMD)  createMcpHandler            (mcp_readonly role,
                                                                          run_sql tool                SELECT-only, 15s timeout)
   ◄───────────────────────  rows (≤5000, truncated flag) → Claude writes the answer  ◄──────────────
```

Read-only is enforced at **three** layers: the replica physically rejects writes · the
`mcp_readonly` role has only `SELECT` · the tool runs each query in a read-only transaction.

---

## 3. Data source — the read replica (done) + the SELECT-only role

The read replica already exists. Create the role **on the PRIMARY** (a replica is read-only,
so `CREATE ROLE` can't run on it; roles are cluster-wide and visible on the replica via shared
storage), then **connect to the REPLICA endpoint** as that role.

```sql
-- Run ONCE on the PRIMARY branch's database, as an admin/owner role:
CREATE ROLE mcp_readonly LOGIN PASSWORD '<strong-password>';
GRANT CONNECT ON DATABASE <db>            TO mcp_readonly;
GRANT USAGE   ON SCHEMA  public           TO mcp_readonly;
GRANT SELECT  ON ALL TABLES IN SCHEMA public TO mcp_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO mcp_readonly;
-- Repeat GRANT USAGE/SELECT for any other schema holding business data.
```

**Connection string** (Worker secret `REPLICA_DATABASE_URL`) — the **pooled replica host** +
`mcp_readonly` creds + a hard statement timeout at the connection level:

```
postgresql://mcp_readonly:<pw>@<replica-pooled-host>/<db>?sslmode=require&options=-c%20statement_timeout%3D15000
```

---

## 4. The Worker — layout, deps, config

**`apps/mcp/`** (pnpm, shares `packages/shared` if useful):

```
apps/mcp/
  src/
    index.ts          # OAuthProvider wraps the MCP handler; routes
    mcp.ts            # createMcpHandler + server instructions + run_sql tool
    google-auth.ts    # upstream Google OAuth (authorize + callback + email allowlist)
    db.ts             # neon() client on REPLICA_DATABASE_URL + query runner (guardrails)
  wrangler.jsonc
  package.json
```

**Dependencies** (verify exact names/versions against current SDK at build time):
- **`agents`** — exports **`createMcpHandler`** from `agents/mcp/server` (the v2 STATELESS path).
- MCP SDK exposing `McpServer` + `registerTool` (post shows `@modelcontextprotocol/server`;
  the McpAgent docs use `@modelcontextprotocol/sdk/server/mcp.js` — confirm the exact package/path).
- `@cloudflare/workers-oauth-provider`
- `@neondatabase/serverless` (Workers-compatible Postgres driver — already used in `apps/api`)

**FOLLOW THE v2 STATELESS PATTERN (blog.cloudflare.com/mcp-v2):** serve via
`export default { fetch: (req,env,ctx) => createMcpHandler(createServer)(req,env,ctx) }` —
**NO Durable Object, NO `migrations`** in `wrangler.jsonc`. Do **NOT** use `McpAgent`
(DO-based) — it was considered and rejected here as heavier than needed (a read-only server
holds no per-session state). `McpAgent` is only a fallback if `createMcpHandler` isn't yet
shipped in the installed `agents` version. OAuth (Phase 2): `new OAuthProvider({ apiRoute:"/mcp",
apiHandler: <createMcpHandler result>, clientIdMetadataDocumentEnabled:true, ... })`.

**`wrangler.jsonc` essentials:**
```jsonc
{
  "name": "sri-aparajita-mcp",
  "main": "src/index.ts",
  "compatibility_date": "2026-08-01",
  "kv_namespaces": [{ "binding": "OAUTH_KV", "id": "<create via wrangler>" }]
  // vars: PUBLIC config only. Secrets set via `wrangler secret put` (below).
}
```

**Secrets** (`wrangler secret put <NAME>`):
- `REPLICA_DATABASE_URL` — the connection string from §3
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — a Google OAuth 2.0 client
- `COOKIE_ENCRYPTION_KEY` (or provider-required signing secret)

`OAUTH_KV` stores issued grants/tokens for `workers-oauth-provider`.

---

## 5. OAuth + Google gate

- `OAuthProvider({ apiRoute: "/mcp", apiHandler: mcpHandler, clientIdMetadataDocumentEnabled: true, resourceMetadata: { resource: "https://sri-aparajita-mcp.<account>.workers.dev/mcp" }, defaultHandler: googleAuthHandler, ... })`.
- `defaultHandler` (`google-auth.ts`) runs the **upstream Google** flow: redirect to Google →
  callback → read the **verified email** → **allow only `support@vardhansystems.in`** (reject
  everyone else with a clear message) → issue the MCP grant.
- Adding the owner later = append their email to the allowlist constant and redeploy.
- Uses CIMD (not deprecated DCR) so Claude registers itself; RFC 8707 `resource` binding on.

---

## 6. The `run_sql` tool + guardrails

**Tool:** `run_sql`
- **Input:** `{ "query": string }`  — a single read-only SQL statement.
- **Description (matters — the model picks tools from it):** "Run ONE read-only SQL query
  against the Sri Aparajita distribution database (a Neon read replica). SELECT only; no writes.
  Discover the schema with `information_schema` (e.g. `select table_name, column_name,
  data_type from information_schema.columns where table_schema='public'`). Results are capped
  at 5000 rows. Prefer explicit `LIMIT`s. Money is `numeric`; dates are IST."
- **Behavior (`db.ts`):**
  1. run inside a **read-only transaction** (`BEGIN READ ONLY … COMMIT`) against the replica,
  2. connection-level `statement_timeout=15000` (from the conn string) kills long queries,
  3. fetch up to **5001 rows**; if >5000, return first 5000 + `truncated: true`,
  4. return `{ columns, rows, rowCount, truncated, elapsedMs }` as compact JSON.
- **Errors:** return the Postgres error message as tool text (treat all returned data as
  **untrusted** — never as instructions).
- **Audit log:** per call, log `{ userEmail, sql, rowCount, elapsedMs, ts }` (Workers logs;
  optionally a small `mcp_query_log` table on the primary later).

**Server instructions** (system text on the MCP server) — set the model up: "You are a
read-only analytics assistant for a lubricant-distribution business (customers = retailers/
workshops; sales executives; orders; invoices; collections; dues; targets; expenditures;
visits). Use `run_sql`. Discover schema via `information_schema`. **Data caveats:** orders
store **no price** (true margin isn't in orders — MOP/DLP live in the price master); **oils
are measured as ORDERED (orders), bearings as BILLED (invoices)** — don't mix sources in a
'total sales' query; state which source you used. Always be explicit about the period/filters."

---

## 7. Build phases (checklist) — ~1–2 focused days

- [ ] **Phase 0 — prep**: create the read replica ✅ (done); create `mcp_readonly` on the
      primary (§3); create the Google OAuth client; create the `OAUTH_KV` namespace.
- [x] **Phase 1 — SQL core (DONE 2026-08-13, verified):** scaffolded `apps/mcp`; v2
      **stateless** `createMcpHandler` (`agents/mcp/server`) + SDK v2 `McpServer`
      (`@modelcontextprotocol/server@2.0.0`) + `run_sql` on the replica (`db.ts`, guardrails
      §6); **no DO, no migrations**. Verified via `wrangler dev` + JSON-RPC: initialize +
      tools/list (run_sql shown) + tools/call (290 customers; top SEs Sandeep/Murali/Upendar).
      **Read-only proven**: UPDATE → "cannot execute UPDATE in a read-only transaction";
      `pg_is_in_recovery()=true`. tsc clean. Files: `src/{index,mcp,db,instructions,worker-env.d}.ts`.
      Notes: env threaded via a module-scope stash (per-request factory carries no Worker env);
      `compatibility_date` pinned to **2026-07-08** (this wrangler's runtime max); replica string
      in `.dev.vars` (gitignored). Installed: `agents@0.20.1`, `@modelcontextprotocol/server@2.0.0`
      + `client@2.0.0` + `sdk@1.30`, `zod@4`, `@neondatabase/serverless@1.1`.
- [x] **Phase 2 — auth (DONE 2026-08-13, verified). NOTE: PASSPHRASE, not Google.** The owner
      chose a **password-gated OAuth** (no Google/third-party). `@cloudflare/workers-oauth-provider`
      (`OAuthProvider`) wraps the MCP handler: `apiRoute:"/mcp"` + `apiHandler` (wraps
      `createMcpHandler`), `defaultHandler`=`src/auth.ts` (renders a passphrase login on
      `/authorize`, validates `env.MCP_PASSPHRASE`, then `completeAuthorization`). Endpoints
      `/authorize` `/token` `/register` (DCR on so Claude self-registers); scope `mcp:read`;
      needs KV binding **`OAUTH_KV`**. Secrets: `REPLICA_DATABASE_URL`, `MCP_PASSPHRASE`.
      **Verified full flow via curl/node**: `/mcp` no-token → 401 + `WWW-Authenticate: Bearer`;
      AS metadata served; DCR register → authorize form → **wrong passphrase 401** → correct
      passphrase 302+code → token exchange (scope mcp:read) → `/mcp` WITH token runs run_sql (290
      customers). tsc clean. (Rationale: claude.ai connector offers only OAuth-or-open, no bearer
      field; passphrase login = simplest real gate for 2 trusted users, no Google Cloud project.)
- [x] **Phase 3 — deploy + connect (DEPLOYED 2026-08-13, verified live).** Created KV
      `OAUTH_KV` (id `57a40507909f423392fba3d926966adb`), set secrets `REPLICA_DATABASE_URL`
      + `MCP_PASSPHRASE`, `wrangler deploy`. **Live URL: `https://sri-aparajita-mcp.vardhansystems.workers.dev`**
      (MCP endpoint `/mcp`). Account: vishnuvardhan@vardhansystems.in. **Verified in prod**:
      `/mcp` no-token→401 + WWW-Authenticate; AS metadata (https issuer); full flow register→
      authorize form→wrong-pass 401→correct-pass→token(mcp:read)→`/mcp` runs run_sql (290
      customers). REMAINING (owner, in Claude UI): **Claude → Settings → Connectors → Add
      custom connector → URL `https://sri-aparajita-mcp.vardhansystems.workers.dev/mcp`, leave OAuth
      fields blank (DCR) → connect → enter the passphrase.**
- [ ] **Phase 4 — harden**: confirm timeout + row cap fire; enable the audit log; add a basic
      rate limit; smoke-test the example questions (§9).

---

## 8. Security / operational notes

- **Read-only in depth:** replica rejects writes + `SELECT`-only role + read-only transaction.
- **PII:** full customer PII is intentionally exposed (owner's own data) — allowlist keeps
  access to authorized emails only; audit log records every query.
- **Prompt-injection:** rows may contain adversarial text (e.g. a customer note) — treated as
  data, never instructions; read-only role caps blast radius.
- **Perf isolation:** all queries hit the **replica**, never the primary/live app.
- **Rotation:** `mcp_readonly` password + Google client secret are rotatable secrets.

---

## 9. Acceptance — example questions it must answer

Dues: "Customers owing > ₹50,000, oldest first." · buckets 0–30/30–45/45–60/60+.
Performance: "Litres by SE this month vs target." · "Who's behind on target?"
Orders: "Invoiced but not delivered." SKU (invoices): "Top 10 billed SKUs last month."
Invoices: "Billed this month + GST." Expenditure: "Spend by category, compulsory vs variable."
Field: "Visits per SE this week." Cross-domain: "Owe > 45 days AND no visit in 3 weeks."

---

## 10. Deferred (not in v1)

- **ChatGPT** support (its `search`/`fetch` connector conventions) — add later.
- **Curated tools** (dashboard/dues/leaderboard) on top of the raw SQL tool.
- **Owner's login** added to the allowlist.
- **Postgres MCP Pro** (`crystaldba/postgres-mcp`, `--access-mode=restricted`, `pipx`) kept as
  an optional **local** power tool (Claude Desktop → replica) for ad-hoc analysis; coexists.
- Optional dedicated read replica tuning / `mcp_query_log` table.

---

## Appendix — reference facts gathered

- **Cloudflare MCP v2** (blog.cloudflare.com/mcp-v2): stateless MCP; `createMcpHandler` now
  official; `McpAgent`/Durable Objects optional; **DCR deprecated → CIMD**; SDK on Web Standards.
- **Neon MCP** (mcp.neon.tech): API-key/OAuth account-scoped, **no raw connection string**,
  runs on the **primary** — can't target the replica → not used here (would only cover the
  "on primary, write-safe" shape).
- **Neon read replica** vs branch: replica = separate read-only compute on shared storage,
  **always current**, isolates load, **scales to zero**, no extra storage — the right source.
- **Generic Postgres MCP**: reference `@modelcontextprotocol/server-postgres` is **archived**;
  `crystaldba/postgres-mcp` is active but **no native OAuth** and SSE-only remote → why we
  chose our own Worker for the remote + OAuth requirement.
