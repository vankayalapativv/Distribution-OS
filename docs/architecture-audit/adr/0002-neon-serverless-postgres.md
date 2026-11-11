# ADR-0002: Neon serverless Postgres via the HTTP driver

- Status: Accepted
- Date: (inferred — confirm against project history)

## Context
The Worker runtime cannot hold long-lived TCP connection pools; each request is a fresh isolate.
The app needs a relational store (financial data, strong constraints, joins).

## Decision
Use **Neon serverless Postgres** accessed through `@neondatabase/serverless` (`neon()` HTTP driver)
in the Worker path (`apps/api/src/lib/db.ts`). Keep the node `postgres` package only in
`packages/db` tooling (setup/seed), never in the Worker.

## Consequences
- **Gain:** works within the Workers connection model; real SQL/constraints; cheap branching and
  many projects/databases (which also keeps the silo/bridge tenancy roads open — see ADR-0003).
- **Give up:** interactive multi-statement transactions are limited to `sql.transaction([...])`
  batches; each query is an HTTP round-trip, so **N+1 loops are disproportionately costly** (see
  audit G-0401/0402/0403) — batching set-based writes is a standing rule.

## Alternatives
- A pooled TCP driver (`pg`/`postgres`) in the Worker — rejected: incompatible with the isolate
  model. Cloudflare D1 — rejected: the domain wants full Postgres features and Neon branching.
