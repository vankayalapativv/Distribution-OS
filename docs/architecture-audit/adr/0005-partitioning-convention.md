# ADR-0005: Domain-partitioned web, technically-partitioned backend

- Status: Accepted (with a noted divergence to revisit)
- Date: (inferred — confirm against project history)

## Context
The playbook's "ideal" is domain partitioning at the top level (Ch. 8). The codebase evolved two
different conventions: the web app groups by capability, the backend groups by layer.

## Decision
- **Web (`apps/web`):** partition by **domain** — `features/<capability>/` (orders, customers,
  collections, …) each holding its api/list/detail/dialog files, over a shared feature-kit
  (`components/data-table`, `components/form`, `lib/api-client`).
- **Backend (`apps/api`):** partition **technically** — `routes/` · `services/` · `lib/` ·
  `middleware/`, one module per resource.

## Consequences
- **Gain (web):** high cohesion, low duplication, close to "ideal"; easy to find everything for a
  capability.
- **Gain (backend):** a consistent, predictable one-module-per-resource layout that is easy to
  navigate; coupling stayed low (audit Phase 1: one cycle in 203 files).
- **Give up / divergence:** the two apps don't share a partitioning mental model, and the backend
  is the clearest structural divergence from "ideal" (audit G-0107). Regrouping the backend by
  domain is a large, churn-heavy change with real risk — **treated as a conscious trade-off**, not
  scheduled work, unless feature velocity starts to suffer.

## Alternatives
- Domain-partition the backend too — deferred (G-0107): the payoff doesn't yet justify the churn.
- Technically-partition the web too — rejected: would lose the web's current cohesion.
