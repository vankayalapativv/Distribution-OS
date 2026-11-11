# Architecture Decision Records (ADRs)

Lightweight decision log per *Fundamentals of Software Architecture* Ch. 19: **architecture is a
stream of decisions**, and recording them is what keeps a solo project coherent over years — and
makes it handoverable/sellable as a SaaS company.

## Why this exists

Decisions today are captured, but **informally and scattered**: `PROJECT-MEMORY.md` (3000+ lines),
`docs/DECISION-live-tracking-multi-device.md`, and many `docs/*-PLAN.md` / `*-AUDIT.md` files.
Valuable, but there is no single, skimmable index of "what did we decide and why." These ADRs
backfill the most significant decisions and set the format for future ones.

## Format (keep it short — one page each)

```
# ADR-NNNN: <title>
- Status: Accepted | Superseded by ADR-XXXX | Proposed
- Date: YYYY-MM-DD
## Context      — the forces at play (constraints, priorities)
## Decision     — what we chose (one or two sentences)
## Consequences — what we gain, what we give up (the trade-off, always)
## Alternatives — what we rejected and why
```

## When to write one

Any decision that is expensive to reverse or that a future maintainer would ask "why is it like
this?": a framework/platform choice, a data-model shift, an auth model, a tenancy model, a
cross-cutting convention. Not every commit — a handful per year.

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [0001](0001-modular-monolith-on-workers.md) | Modular monolith on Cloudflare Workers (not microservices) | Accepted |
| [0002](0002-neon-serverless-postgres.md) | Neon serverless Postgres via the HTTP driver | Accepted |
| [0003](0003-single-client-silo.md) | Single-client silo — remove multi-tenant scaffolding | Accepted |
| [0004](0004-neon-managed-auth.md) | Neon Managed Auth (EdDSA JWT); retire legacy HS256/PBKDF2 | Accepted |
| [0005](0005-partitioning-convention.md) | Domain-partitioned web, technically-partitioned backend | Accepted (with a noted divergence) |

> These five were **inferred from the codebase and its history** during the architecture audit
> (2026-09). Confirm the dates/context against `PROJECT-MEMORY.md` before treating them as
> canonical, and supersede rather than edit when a decision changes.
