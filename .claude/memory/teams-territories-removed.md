---
name: teams-territories-removed
description: "Teams & Territories removed from SA entirely (UI/API/DB, migration 0009) — don't reintroduce"
metadata:
  node_type: memory
  type: project
  originSessionId: 08350f47-afcb-4601-a27d-914d40a5a0b0
  modified: 2026-11-03T19:23:53.475Z
---

Teams & Territories were removed from Sri Aparajita end-to-end on 2026-11-03, the same way [[user-deletion-removed]] was. Migration `0009_drop_teams_territories.sql` (applied to prod) dropped the `teams`, `team_members`, `territories` tables and the `territory_id` column from `customers`, `orders`, `invoices`, `collections`, `visits`, `beat_plans`. The "Add team / Add Territory" UI on the Users & Teams page, and all team/territory API routes + service code, are gone. `GET /super-admin/setup` is **users-only** now.

**Why:** the single-client distributor didn't use team/territory grouping; it was dead scaffolding (like the org_id multi-tenant removal in 0034/0035). **How to apply:** don't reintroduce teams/territories or a `territory_id` column; if beat/geographic grouping is ever needed again, design it fresh. Deployed API + web to prod after migrating.
