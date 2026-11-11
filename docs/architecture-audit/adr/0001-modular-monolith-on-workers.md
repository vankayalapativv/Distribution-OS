# ADR-0001: Modular monolith on Cloudflare Workers (not microservices)

- Status: Accepted
- Date: (inferred — confirm against project history)

## Context
Solo developer; priorities are maintainability, feature velocity, performance, then SaaS
evolvability, low cost, simplicity. The backend must run on Cloudflare Workers (V8 isolates,
per-request horizontal scaling, no long-lived connections).

## Decision
Build the backend as a **single Hono app deployed as one Worker** (`apps/api`), internally layered
`routes → services → lib`. Do not distribute into microservices.

## Consequences
- **Gain:** lowest operational and cognitive overhead for one person; one deploy, one place to
  reason; Workers already scale horizontally per request, so scalability needs no distribution.
- **Give up:** independent per-component scaling/deploy; a genuinely different-shaped workload
  (e.g. heavy async report generation) would need a separate quantum if it ever appears.
- The book's rule holds: split only at a real architecture-quantum boundary (Ch. 7), never for
  fashion.

## Alternatives
- **Microservices** — rejected: heavy ops/cost/reasoning penalty that would sacrifice the top
  priorities to buy scalability already available on Workers.
