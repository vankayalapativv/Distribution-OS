---
name: mcp-settings-page
description: "Settings → MCP page manages the deployed read-only MCP server (apps/mcp); inbound-only, passphrase is shown in the UI; needed global_fetch_strictly_public for api→mcp"
metadata:
  node_type: memory
  type: project
  originSessionId: 12720c61-e5eb-4eca-b2b9-b353815e7330
  modified: 2026-10-30T06:13:07.566Z
---

Built + deployed 2026-10-30: a **Settings → MCP** page (SUPER_ADMIN + MANAGER) that manages the already-deployed read-only MCP server at `apps/mcp` (`https://sri-aparajita-mcp.vardhansystems.workers.dev/mcp`, OAuth + passphrase gate, tools `run_sql`/`get_audit_log`/`render_map` over a Neon read replica).

Architecture:
- `apps/mcp`: a strongly-consistent `ConfigDO` holds `{ enabled, passphrase }`. **Passphrase is stored in PLAINTEXT on purpose** — it's a shared access key the admin must see and share, not a personal login; the UI shows it in full with a copy button. Falls back to the legacy `MCP_PASSPHRASE` env secret when the DO passphrase is null (keeps the live connection working). Bearer-gated `/admin/*` API (`MCP_ADMIN_SECRET`).
- `apps/api`: `/mcp/server` (+ `/server/audit`) proxy routes call the MCP Worker's `/admin` API server-to-server with the shared `MCP_ADMIN_SECRET`; `MCP_SERVER_ORIGIN` var points at the MCP worker.
- `apps/web`: inbound-only panel (`features/settings/settings-mcp*.tsx`) — on/off, visible+editable passphrase, connect guide, recent-activity.

**Inbound only.** An outbound-connection registry (migration 0002 + routes/service) was built then fully removed (migration 0003 drops the table) — the app only exposes itself, never connects out. Don't reintroduce it.

**Gotcha (cost us several redeploys):** the api→mcp `fetch()` failed in prod with "Could not reach the MCP server" because a same-account `*.workers.dev` fetch isn't routed to the public edge by default. Fix = add **`global_fetch_strictly_public`** to `apps/api` `compatibility_flags`. Worked locally (localhost fetch) but not prod until the flag.

Secrets required in prod: `apps/mcp` needs `MCP_ADMIN_SECRET`, `MCP_PASSPHRASE` (or a UI-set passphrase), `REPLICA_DATABASE_URL`, `MAP_SIGNING_SECRET`; `apps/api` needs `MCP_ADMIN_SECRET` (+ `MCP_SERVER_ORIGIN` var). Setting prod secrets / deploying is blocked for Claude by the auto-mode classifier — the user runs those. Related: [[local-dev-uses-live-prod]].
