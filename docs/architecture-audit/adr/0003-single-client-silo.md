# ADR-0003: Single-client silo — remove multi-tenant scaffolding

- Status: Accepted (revisit if SaaS becomes a committed goal)
- Date: migrations 0034/0035 (2026-07-23)

## Context
The system began with multi-tenant scaffolding (`organization_id` on every table + an
`(select id from organizations limit 1)` insert pattern) but is deployed as **one backend + one
DB per customer**. The scaffolding added complexity to every query and insert while serving no
active second tenant. Priorities #5 (cost) and #6 (simplicity) dominated.

## Decision
**Remove `organization_id` and the `organizations` table** (migrations 0034/0035), along with ~27
unused tables. Operate as a **single-tenant silo**: isolation is provided by a physically separate
database per deployment.

## Consequences
- **Gain:** simplest possible data model and queries; strongest isolation (physical DB separation);
  no tenant-filter bugs possible.
- **Give up:** SaaS-in-one-deployment (priority #4). Onboarding a new customer currently requires a
  new DB + deploy + **code edits for branding** — see audit G-0302/G-0303. This is the deliberate
  trade-off, not an oversight.
- **Reversibility:** the pooled model (re-add `tenant_id` + RLS) is the expensive way back; the
  **bridge** model (DB-per-tenant, shared Worker) is the cheaper evolution and reuses config-
  extraction + a migration-runner that are worth doing anyway (audit Phase 3).

## Alternatives
- **Pool** (shared DB + `tenant_id` + RLS) — rejected for now: highest code complexity, weakest
  isolation, undoes this simplification; only justified at many-small-tenants scale.
- **Bridge** (DB-per-tenant) — deferred: the natural SaaS road when demand is real.
