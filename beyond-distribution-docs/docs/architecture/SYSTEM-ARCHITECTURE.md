# System Architecture

## Core Architecture

```text
Next.js Web App
      │
      ▼
Hono API
      │
      ├── Neon Auth session validation
      ├── Role authorization
      ├── Data-scope authorization
      ├── Configurable business rules
      ├── Workflow state transitions
      ├── File/PDF upload handling
      ├── GPS ingestion
      └── Database access
              │
              ▼
        PostgreSQL / Neon
```

## Principle

The system is not a simple CRM. It is a distribution operations platform covering:

- field sales execution
- customer onboarding
- order capture
- invoice PDF upload
- payment collection capture
- accountant verification
- collection reconciliation
- route and logistics fulfilment
- GPS tracking
- performance dashboards
- configurable rules
- sales executive incentives

## Application Boundaries

### Next.js Web App

Used by Super Admin, Manager, and Accountant users only. Sales Executive and Logistics are field roles served by the mobile app — never by web UI.

The first version is web-first. A React Native (Expo) mobile app for Sales Executives is planned as the next client (see the root `MOBILE_PLAN.md`); Logistics mobile support comes later.

### Hono API

The Hono backend owns:

- auth validation
- RBAC
- data ownership checks
- rule execution
- transactional writes
- workflow transitions
- PDF upload metadata
- GPS logging
- dashboard APIs

### PostgreSQL / Neon

The database stores:

- users and roles
- customers
- territories
- beats
- visits
- GPS logs
- orders
- invoices
- collections
- fulfilment trips
- configurable rules
- approvals
- metrics
- incentives
- audit logs

## No AI / WhatsApp in V1

AI recommendations and WhatsApp automation are intentionally excluded from V1.
Do not add AI tables, embeddings, LLM prompts, vector stores, WhatsApp campaigns, or automation flows unless the scope changes.
