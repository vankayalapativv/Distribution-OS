---
name: neon-backups-and-privacy
description: "Neon project facts (Launch plan, Singapore, single prod branch = dev hits prod), backups set up 2026-11-06 (7-day PITR + daily snapshots), and the honest \"can you see my data?\" client answer + hardening gaps"
metadata:
  node_type: memory
  type: project
  originSessionId: 2c06702b-3efc-43f7-8299-8c9a443be0e0
  modified: 2026-11-05T22:56:16.270Z
---

Verified live via Neon MCP on 2026-11-06. Neon project **"Sri Aparajita"** = id `odd-pine-20025067`, org `org-little-term-46132689` (owner vishnuvardhan@vardhansystems.in), region **aws-ap-southeast-1 (Singapore)**, Postgres 18, plan **Launch** (`launch_v3`). ONE project member (the owner). ONE branch **`production`** (`br-holy-hat-b3qw1f8w`), ~70 MB, not protected → confirms [[local-dev-uses-live-prod]] (no dev branch, local wrangler/Next hit prod).

**Backups configured 2026-11-06 (Layers 1+2 done; Layer 3 deferred):**
- **Layer 1 — PITR history window raised 1 day → 7 days** (`history_retention_seconds` 86400 → 604800) via `update_project`. Launch max is 7 days; ~$0.20/GB-month, trivial at 70 MB. Restore to any second in last week.
- **Layer 2 — daily snapshot schedule** via `set_snapshot_schedule` on the production branch: `{frequency:daily, hour:20 (UTC = 01:30 IST, captures the full business day), retention_seconds:3024000 (35 days, the max)}`. First scheduled run = that night. Scheduled snapshots auto-expire at 35 days; manual ones never expire.
- **Manual baseline snapshot** taken: `manual-2026-11-06-baseline` (`snap-nameless-hall-b3nsik5w`) — permanent known-good restore point.
- **Layer 3 — external `pg_dump` off Neon — DEFERRED** (user: "later"). The only copy that survives losing the Neon account; weekly dump to user-owned storage (R2/local). ⚠️ would connect to the LIVE prod DB (read-only), prod credential must not be committed.
- All reversible (lower window, delete schedule/snapshots). Snapshot-schedule tool shape: entries take `frequency` (daily|weekly|monthly), `hour`, `day`, `month`, `retention_seconds` (3600–3024000) — NOT `retention_days`. `get/set_snapshot_schedule` need `branch_id` at top level (not nested in `params`).

**"Can a client see... can YOU see my data?" — the honest stance.** No hosted provider can promise "never see your data"; the true claim is limited, purpose-bound access. What's honestly sayable TODAY: data in its OWN dedicated Neon DB (not shared with other customers), exactly ONE person (owner) has access, encrypted in transit + at rest, host (Neon) is SOC 2 Type II. Caveat: owner holds the technical keys (unavoidable for hosted software), used only to run/support or when the client asks.

**Hardening gaps to close before STRONGER promises (all currently open):** no IP allow-list (`allowed_ips.ips: []`); `block_public_connections: false` (public connections allowed); `store_passwords: true` (Neon stores role passwords); no separate dev branch (dev = prod); production branch not protected; no access/audit logs on Launch. To back "network-restricted + access-logged + longer retention + per-distributor isolation" promises, upgrade **Launch → Scale** (Scale PITR max = 30 days). ⚠️ exact per-plan feature boundaries (IP-allow/audit-logs tier) must be re-verified on Neon's pricing page before putting specifics in a signed contract.
