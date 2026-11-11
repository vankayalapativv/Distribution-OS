# Sri Aparajita Distribution Management System — Backend API Plan

> Note: this file is a duplicate — the canonical copy is `docs/BACKEND-API-PLAN.md`.

## Stack
- Hono REST API
- Neon PostgreSQL
- Neon Auth
- Zod validation
- Cloudflare R2 file storage

## Authorization Strategy
Use hardcoded role/data-scope authorization for stable access boundaries, and Super Admin-configurable business rules and approval thresholds.

## Phase 0 — System and Auth Context
```http
GET /health
GET /me
GET /me/permissions
GET /me/scope
```

## Phase 1 — Users, Roles, Teams and Territories

### Users
```http
GET /users
GET /users/:id
POST /users
PATCH /users/:id
PATCH /users/:id/status
```

### Roles
```http
GET /roles
GET /roles/:role
GET /roles/:role/permissions
```

### Teams
```http
GET /teams
GET /teams/:id
POST /teams
PATCH /teams/:id
DELETE /teams/:id
GET /teams/:id/members
POST /teams/:id/members
DELETE /teams/:id/members/:userId
```

### Territories
```http
GET /territories
GET /territories/:id
POST /territories
PATCH /territories/:id
DELETE /territories/:id
GET /territories/:id/assignments
POST /territories/:id/assignments
PATCH /territories/:id/assignments/:assignmentId/end
```

## Phase 2 — Customers
```http
GET /customers
GET /customers/:id
POST /customers
PATCH /customers/:id
PATCH /customers/:id/status

GET /customers/:id/contacts
POST /customers/:id/contacts
PATCH /customers/:id/contacts/:contactId
DELETE /customers/:id/contacts/:contactId

GET /customers/:id/addresses
POST /customers/:id/addresses
PATCH /customers/:id/addresses/:addressId
DELETE /customers/:id/addresses/:addressId

GET /customers/:id/documents
POST /customers/:id/documents/upload-url
POST /customers/:id/documents
DELETE /customers/:id/documents/:documentId

GET /customers/:id/assignments
POST /customers/:id/assignments
PATCH /customers/:id/assignments/:assignmentId/end

POST /customers/:id/submit-approval
POST /customers/:id/approve
POST /customers/:id/reject
```

## Phase 3 — Visits and GPS

### Work Sessions
```http
POST /work-sessions/start
POST /work-sessions/end
GET /work-sessions/current
GET /work-sessions
GET /work-sessions/:id
```

### GPS
```http
POST /gps/sessions/start
POST /gps/sessions/:id/points
POST /gps/sessions/:id/end
GET /gps/sessions/:id
GET /gps/sessions/:id/points
```

GPS is captured every 5 minutes between login/logout or logistics journey start/end.

### Visits
```http
GET /visits
GET /visits/:id
POST /visits
POST /visits/:id/check-in
POST /visits/:id/check-out
PATCH /visits/:id/outcome
POST /visits/:id/photos/upload-url
POST /visits/:id/photos
```

## Phase 4 — Orders
```http
GET /orders
GET /orders/:id
POST /orders
PATCH /orders/:id
DELETE /orders/:id

GET /orders/:id/items
POST /orders/:id/items
PATCH /orders/:id/items/:itemId
DELETE /orders/:id/items/:itemId

POST /orders/:id/submit
POST /orders/:id/approve
POST /orders/:id/reject
POST /orders/:id/cancel
```

## Phase 5 — Invoice PDF Upload
```http
POST /invoices/upload-url
POST /invoices/from-pdf
GET /invoices
GET /invoices/:id
GET /invoices/:id/document
GET /invoices/:id/items
GET /invoices/:id/outstanding
GET /customers/:id/invoices
GET /customers/:id/outstanding
```

V1 invoice source is PDF upload. Files live in R2; metadata lives in PostgreSQL.

## Phase 6 — Collections and Accountant Verification
```http
GET /collections
GET /collections/:id
POST /collections
PATCH /collections/:id
DELETE /collections/:id

POST /collections/:id/proof/upload-url
POST /collections/:id/proof
GET /collections/:id/proof

POST /collections/:id/submit-verification
POST /collections/:id/approve
POST /collections/:id/reject

GET /collections/:id/allocations
POST /collections/:id/allocations
PATCH /collections/:id/allocations/:allocationId
DELETE /collections/:id/allocations/:allocationId

POST /collections/:id/reconcile
GET /reconciliation/pending
GET /reconciliation/history
```

Sales Executives record collections and upload proof. Accountants verify, allocate and reconcile them.

## Phase 7 — Logistics and Driver Fulfilment

### Vehicles
```http
GET /vehicles
GET /vehicles/:id
POST /vehicles
PATCH /vehicles/:id
PATCH /vehicles/:id/status
```

### Trips
```http
GET /fulfilment-trips
GET /fulfilment-trips/:id
POST /fulfilment-trips
POST /fulfilment-trips/:id/start
POST /fulfilment-trips/:id/end
```

### Trip Invoices and Stops
```http
GET /fulfilment-trips/:id/invoices
POST /fulfilment-trips/:id/invoices
DELETE /fulfilment-trips/:id/invoices/:invoiceId

GET /fulfilment-trips/:id/stops
POST /fulfilment-trips/:id/stops/:stopId/arrive
POST /fulfilment-trips/:id/stops/:stopId/deliver
POST /fulfilment-trips/:id/stops/:stopId/skip
```

### Proof and Odometer
```http
POST /fulfilment-trips/:id/stops/:stopId/proof/upload-url
POST /fulfilment-trips/:id/stops/:stopId/proof
POST /fulfilment-trips/:id/odometer/start
POST /fulfilment-trips/:id/odometer/end
```

Driver flow: login → select vehicle → select destination/region → enter starting odometer → start journey/GPS → deliver at each stop → upload delivery proof → return to branch → enter ending odometer → end trip.

## Phase 8 — Rules, Approvals and Alerts

### Rules
```http
GET /rules
GET /rules/:id
POST /rules
PATCH /rules/:id
DELETE /rules/:id
PATCH /rules/:id/status
POST /rules/:id/test
GET /rules/:id/executions
```

### Approvals
```http
GET /approvals
GET /approvals/:id
POST /approvals/:id/approve
POST /approvals/:id/reject
POST /approvals/:id/request-change
```

### Alerts
```http
GET /alerts
GET /alerts/:id
POST /alerts/:id/assign
POST /alerts/:id/resolve
POST /alerts/:id/reopen
```

## Phase 9 — KPI and Dashboards

### Executive
```http
GET /dashboard/executive/summary
GET /dashboard/executive/visits
GET /dashboard/executive/orders
GET /dashboard/executive/collections
GET /dashboard/executive/kpi
```

### Manager
```http
GET /dashboard/manager/summary
GET /dashboard/manager/team-performance
GET /dashboard/manager/territory-performance
GET /dashboard/manager/pending-approvals
GET /dashboard/manager/collection-risk
```

### Accountant
```http
GET /dashboard/accountant/summary
GET /dashboard/accountant/pending-verifications
GET /dashboard/accountant/outstanding
GET /dashboard/accountant/aging
GET /dashboard/accountant/reconciliation
```

### Super Admin
```http
GET /dashboard/super-admin/summary
GET /dashboard/super-admin/sales
GET /dashboard/super-admin/collections
GET /dashboard/super-admin/gps
GET /dashboard/super-admin/team-performance
GET /dashboard/super-admin/risk
GET /dashboard/super-admin/incentives
```

## Phase 10 — Sales Executive Incentives
```http
GET /incentive-plans
GET /incentive-plans/:id
POST /incentive-plans
PATCH /incentive-plans/:id
PATCH /incentive-plans/:id/status

POST /incentives/calculate
GET /incentives
GET /incentives/:id

POST /incentives/:id/approve
POST /incentives/:id/reject
POST /incentives/:id/mark-paid
```

Only Super Admin configures and approves Sales Executive incentives.

## Phase 11 — Audit Logs
```http
GET /audit-logs
GET /audit-logs/:id
GET /audit-logs/entity/:entityType/:entityId
```

## Implementation Order
1. Phase 0 — health, auth context, authorization foundation
2. Phase 1 — users, roles, teams, territories
3. Phase 2 — customers
4. Phase 3 — visits and GPS
5. Phase 4 — orders
6. Phase 5 — invoice PDF upload and R2
7. Phase 6 — collections and accountant verification
8. Phase 7 — logistics fulfilment
9. Phase 8 — configurable rules, approvals and alerts
10. Phase 9 — KPI and dashboards
11. Phase 10 — incentives
12. Phase 11 — audit query APIs and hardening

## Backend Engineering Principles

- Never trust role claims from the frontend.
- Resolve Neon Auth identity on the server.
- Enforce both role permission and row-level data scope.
- Validate path params, query params and bodies with Zod.
- Keep route handlers thin: route → validation → auth → authorization → service → repository → audit/event → response.
- Use database transactions for collection approval, allocation, reconciliation and outstanding updates.
- Store files in R2 and only metadata/object keys in PostgreSQL.
- Preserve historical ownership on visits, orders, collections and GPS sessions.
- Do not introduce AI, WhatsApp or inventory modules in V1.

## Immediate Milestone

Implement Phase 0 and Phase 1 first. Do not begin Customer APIs until authentication context, role enforcement, team scope and territory scope are working correctly.
