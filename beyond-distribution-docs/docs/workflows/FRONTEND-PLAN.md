# Sri Aparajita Distribution Management System — Next.js Frontend Plan

## 1. Purpose

This document defines the phase-wise frontend plan for the **Next.js web application** of Sri Aparajita Distribution Management System.

The web application is for:

```text
Super Admin
Manager
Accountant
```

Sales Executive and Logistics are not part of the V1 web dashboard scope unless explicitly added later.

## 2. Confirmed Frontend Decisions

| Area | Decision |
|---|---|
| Framework | Next.js |
| UI Library | shadcn/ui |
| Styling | Tailwind CSS |
| App Type | CRM-style web dashboard |
| Layout | Shared dashboard layout with role-based sidebar |
| Auth UI | Login page only |
| Signup | No public signup |
| User Creation | Super Admin creates users |
| Primary Roles | Super Admin, Manager, Accountant |
| Backend API | Hono REST API |
| Auth Provider | Neon Auth |

## 3. Recommended Frontend Build Order

Because the web app is only for Super Admin, Manager, and Accountant, the correct frontend order is:

```text
Phase 0: App shell, design system, auth guard
Phase 1: Login and role-based dashboard layout
Phase 2: Super Admin user/team/territory management
Phase 3: Customer management
Phase 4: Orders and invoice PDF upload
Phase 5: Collections and accountant verification
Phase 6: Manager execution dashboard
Phase 7: Super Admin control tower
Phase 8: Rules, approvals, alerts
Phase 9: Incentives
Phase 10: Audit logs and hardening
```

Do not start with Sales Executive screens, GPS screens, or Logistics screens in the web dashboard. Those can come later if the business wants web access for those roles.

---

# 4. Frontend Architecture

## Recommended Folder Structure

```text
apps/web/
  src/
    app/
      (auth)/
        login/
          page.tsx

      (dashboard)/
        layout.tsx
        dashboard/
          page.tsx

        users/
        teams/
        territories/
        customers/
        orders/
        invoices/
        collections/
        approvals/
        alerts/
        rules/
        incentives/
        reports/
        audit-logs/

    components/
      layout/
        dashboard-shell.tsx
        dashboard-sidebar.tsx
        dashboard-header.tsx
        role-sidebar-items.ts
        user-menu.tsx

      ui/
        shadcn components

      common/
        data-table.tsx
        page-header.tsx
        status-badge.tsx
        empty-state.tsx
        confirm-dialog.tsx
        form-section.tsx
        file-upload-card.tsx

    features/
      auth/
      users/
      teams/
      territories/
      customers/
      orders/
      invoices/
      collections/
      approvals/
      alerts/
      rules/
      incentives/
      dashboards/
      audit-logs/

    lib/
      api-client.ts
      auth.ts
      permissions.ts
      navigation.ts
      utils.ts
      constants.ts

    hooks/
      use-current-user.ts
      use-permissions.ts
      use-role-navigation.ts

    types/
      api.ts
      roles.ts
      navigation.ts
```

## Frontend Rule

The frontend must never contain final authorization logic.

It can hide/show UI for convenience, but the Hono API must enforce real permissions.

```text
Frontend role checks = UX convenience
Backend role checks = security
```

---

# Phase 0 — App Shell and Design System

## Purpose

Create the visual foundation of the CRM-style dashboard.

## Build

- Install and configure shadcn/ui
- Set up Tailwind theme
- Create shared dashboard shell
- Create page header component
- Create reusable data table
- Create form layout components
- Create status badges
- Create empty states
- Create confirmation dialog
- Create loading and error states

## Core Components

```text
DashboardShell
DashboardSidebar
DashboardHeader
PageHeader
DataTable
StatusBadge
EmptyState
ConfirmDialog
FormSection
FileUploadCard
```

## Completion Criteria

Phase 0 is complete when the app has a working dashboard visual shell and reusable CRM-style UI components.

---

# Phase 1 — Login and Role-Based Layout

## Purpose

Allow authenticated users to log in and access the dashboard.

## Pages

```text
/login
/dashboard
```

## API Dependencies

```http
GET /me
GET /me/permissions
GET /me/scope
```

## Behavior

- No public signup.
- Login page only.
- Super Admin account is created manually/externally first.
- After login, fetch current user.
- Redirect users based on role.
- Show sidebar items based on role.

## Shared Layout

All roles use one dashboard layout:

```text
DashboardLayout
  ├── Sidebar
  ├── Header
  └── Page Content
```

## Role-Based Sidebar

### Super Admin Sidebar

```text
Dashboard
Users
Teams
Territories
Customers
Orders
Invoices
Collections
Approvals
Alerts
Rules
Incentives
Reports
Audit Logs
Settings
```

### Manager Sidebar

```text
Dashboard
Team Performance
Territories
Customers
Orders
Collections
Approvals
Alerts
Reports
```

### Accountant Sidebar

```text
Dashboard
Invoices
Collections
Pending Verification
Reconciliation
Outstanding
Aging
Reports
```

## Completion Criteria

Phase 1 is complete when Super Admin, Manager, and Accountant see different sidebar navigation after login.

---

# Phase 2 — Super Admin Setup: Users, Teams and Territories

## Purpose

Super Admin must be able to create the business structure before operational workflows begin.

This should be the first real module after auth because Customers, Orders, Collections, and Dashboards depend on users, teams, and territories.

## Pages

```text
/users
/users/new
/users/[id]
/users/[id]/edit

/teams
/teams/new
/teams/[id]
/teams/[id]/edit
/teams/[id]/members

/territories
/territories/new
/territories/[id]
/territories/[id]/edit
/territories/[id]/assignments
```

## API Dependencies

```http
GET    /users
GET    /users/:id
POST   /users
PATCH  /users/:id
PATCH  /users/:id/status

GET /roles
GET /roles/:role/permissions

GET    /teams
GET    /teams/:id
POST   /teams
PATCH  /teams/:id
DELETE /teams/:id

GET    /teams/:id/members
POST   /teams/:id/members
DELETE /teams/:id/members/:userId

GET    /territories
GET    /territories/:id
POST   /territories
PATCH  /territories/:id
DELETE /territories/:id

GET   /territories/:id/assignments
POST  /territories/:id/assignments
PATCH /territories/:id/assignments/:assignmentId/end
```

## Main UI Components

- Users table
- User creation form
- Role selector
- Status badge
- Team assignment panel
- Territory assignment panel
- Manager assignment selector
- Active/inactive toggle

## Role Access

### Super Admin

Full access.

### Manager

Read-only or limited access to assigned team/territory data.

### Accountant

No access unless specifically required later.

## Completion Criteria

Phase 2 is complete when Super Admin can:

- create Manager, Accountant, and Sales Executive users;
- create teams;
- assign team members;
- create territories;
- assign managers and executives to territories;
- activate/deactivate users.

---

# Phase 3 — Customer Management

## Purpose

Manage customer records and assignment to Sales Executives.

## Pages

```text
/customers
/customers/new
/customers/[id]
/customers/[id]/edit
/customers/[id]/contacts
/customers/[id]/addresses
/customers/[id]/documents
/customers/[id]/assignments
/customers/[id]/outstanding
```

## API Dependencies

```http
GET    /customers
GET    /customers/:id
POST   /customers
PATCH  /customers/:id
PATCH  /customers/:id/status

GET    /customers/:id/contacts
POST   /customers/:id/contacts
PATCH  /customers/:id/contacts/:contactId
DELETE /customers/:id/contacts/:contactId

GET    /customers/:id/addresses
POST   /customers/:id/addresses
PATCH  /customers/:id/addresses/:addressId
DELETE /customers/:id/addresses/:addressId

GET    /customers/:id/documents
POST   /customers/:id/documents/upload-url
POST   /customers/:id/documents
DELETE /customers/:id/documents/:documentId

GET   /customers/:id/assignments
POST  /customers/:id/assignments
PATCH /customers/:id/assignments/:assignmentId/end

POST /customers/:id/submit-approval
POST /customers/:id/approve
POST /customers/:id/reject
```

## UI Requirements

Customer list should support:

- search
- filters
- status
- territory
- assigned executive
- customer grade
- payment status
- export later

Customer detail page should show:

```text
Profile
Contacts
Addresses
Documents
Assignments
Orders
Invoices
Outstanding
Collections
Visits summary
```

## Role Access

### Super Admin

Full access.

### Manager

Access customers within assigned teams/territories.

### Accountant

Access customer financial sections only where needed:

- invoices
- outstanding
- collections
- reconciliation context

## Completion Criteria

Phase 3 is complete when customer onboarding, assignment, documents, and status changes work.

---

# Phase 4 — Orders and Invoice PDF Upload

## Purpose

Allow web users to review orders and upload/manage invoice PDFs.

Since Sales Executives are not in V1 web scope, order creation from web can be limited to Super Admin/Manager if required. Otherwise, web can start as review-only for orders.

## Pages

```text
/orders
/orders/[id]
/orders/[id]/items

/invoices
/invoices/upload
/invoices/[id]
/invoices/[id]/document
/invoices/[id]/outstanding
```

## API Dependencies

```http
GET    /orders
GET    /orders/:id
POST   /orders
PATCH  /orders/:id
DELETE /orders/:id

GET    /orders/:id/items
POST   /orders/:id/items
PATCH  /orders/:id/items/:itemId
DELETE /orders/:id/items/:itemId

POST /orders/:id/submit
POST /orders/:id/approve
POST /orders/:id/reject
POST /orders/:id/cancel

POST /invoices/upload-url
POST /invoices/from-pdf
GET  /invoices
GET  /invoices/:id
GET  /invoices/:id/document
GET  /invoices/:id/items
GET  /invoices/:id/outstanding
GET  /customers/:id/invoices
GET  /customers/:id/outstanding
```

## Invoice Upload UI Flow

```text
Open Invoice Upload page
        ↓
Select customer/order
        ↓
Upload PDF
        ↓
Enter invoice metadata
        ↓
Submit
        ↓
Invoice created
        ↓
Outstanding initialized
```

## Completion Criteria

Phase 4 is complete when invoice PDFs can be uploaded to R2 and invoice metadata is visible in the dashboard.

---

# Phase 5 — Collections and Accountant Verification

## Purpose

Build the Accountant workflow.

## Pages

```text
/collections
/collections/[id]
/collections/[id]/proof
/collections/[id]/allocations

/reconciliation/pending
/reconciliation/history

/accountant/pending-verification
/accountant/outstanding
/accountant/aging
```

## API Dependencies

```http
GET    /collections
GET    /collections/:id
POST   /collections
PATCH  /collections/:id
DELETE /collections/:id

POST /collections/:id/proof/upload-url
POST /collections/:id/proof
GET  /collections/:id/proof

POST /collections/:id/submit-verification
POST /collections/:id/approve
POST /collections/:id/reject

GET    /collections/:id/allocations
POST   /collections/:id/allocations
PATCH  /collections/:id/allocations/:allocationId
DELETE /collections/:id/allocations/:allocationId

POST /collections/:id/reconcile
GET  /reconciliation/pending
GET  /reconciliation/history
```

## Accountant Flow

```text
Open pending verification
        ↓
Review collection details
        ↓
View payment proof
        ↓
Approve or reject
        ↓
Allocate collection to invoice(s)
        ↓
Reconcile
        ↓
Outstanding updates
```

## Completion Criteria

Phase 5 is complete when Accountant can verify and reconcile payments.

---

# Phase 6 — Manager Execution Dashboard

## Purpose

Give Manager visibility over team execution and territory performance.

## Pages

```text
/dashboard/manager
/manager/team-performance
/manager/territory-performance
/manager/pending-approvals
/manager/collection-risk
/manager/executives/[id]
```

## API Dependencies

```http
GET /dashboard/manager/summary
GET /dashboard/manager/team-performance
GET /dashboard/manager/territory-performance
GET /dashboard/manager/pending-approvals
GET /dashboard/manager/collection-risk
```

## Dashboard Cards

- total team sales
- collection amount
- pending approvals
- overdue risk
- productive visits
- low-performing executives
- territory performance

## Completion Criteria

Phase 6 is complete when Manager can monitor assigned teams and territories.

---

# Phase 7 — Super Admin Control Tower

## Purpose

Provide full business visibility to the Super Admin.

## Pages

```text
/dashboard/super-admin
/super-admin/sales
/super-admin/collections
/super-admin/gps
/super-admin/team-performance
/super-admin/risk
/super-admin/incentives
```

## API Dependencies

```http
GET /dashboard/super-admin/summary
GET /dashboard/super-admin/sales
GET /dashboard/super-admin/collections
GET /dashboard/super-admin/gps
GET /dashboard/super-admin/team-performance
GET /dashboard/super-admin/risk
GET /dashboard/super-admin/incentives
```

## Dashboard Cards

- total sales
- total collection
- outstanding
- overdue
- pending approvals
- active executives
- team performance
- territory performance
- incentive liability
- high-risk customers

## Completion Criteria

Phase 7 is complete when Super Admin can monitor the whole business from one dashboard.

---

# Phase 8 — Rules, Approvals and Alerts

## Purpose

Allow Super Admin to configure rules and manage approval/alert workflows.

## Pages

```text
/rules
/rules/new
/rules/[id]
/rules/[id]/edit
/rules/[id]/executions

/approvals
/approvals/[id]

/alerts
/alerts/[id]
```

## API Dependencies

```http
GET    /rules
GET    /rules/:id
POST   /rules
PATCH  /rules/:id
DELETE /rules/:id
PATCH  /rules/:id/status
POST   /rules/:id/test
GET    /rules/:id/executions

GET  /approvals
GET  /approvals/:id
POST /approvals/:id/approve
POST /approvals/:id/reject
POST /approvals/:id/request-change

GET  /alerts
GET  /alerts/:id
POST /alerts/:id/assign
POST /alerts/:id/resolve
POST /alerts/:id/reopen
```

## Rule Builder UI

V1 should keep rule builder simple.

Recommended fields:

```text
Rule name
Module
Trigger event
Condition field
Operator
Value
Action
Severity
Approval required
Active/inactive
```

## Completion Criteria

Phase 8 is complete when Super Admin can create, update, enable/disable, and test business rules.

---

# Phase 9 — Sales Executive Incentives

## Purpose

Allow Super Admin to configure and approve Sales Executive incentive plans.

## Pages

```text
/incentive-plans
/incentive-plans/new
/incentive-plans/[id]
/incentive-plans/[id]/edit

/incentives
/incentives/[id]
```

## API Dependencies

```http
GET    /incentive-plans
GET    /incentive-plans/:id
POST   /incentive-plans
PATCH  /incentive-plans/:id
PATCH  /incentive-plans/:id/status

POST /incentives/calculate
GET  /incentives
GET  /incentives/:id

POST /incentives/:id/approve
POST /incentives/:id/reject
POST /incentives/:id/mark-paid
```

## V1 Rule

Only Super Admin can configure and approve incentives.

Manager and Accountant can view incentive-related reports only if permission is granted later.

---

# Phase 10 — Audit Logs and Hardening

## Purpose

Give traceability for sensitive operations.

## Pages

```text
/audit-logs
/audit-logs/[id]
/audit-logs/entity/[entityType]/[entityId]
```

## API Dependencies

```http
GET /audit-logs
GET /audit-logs/:id
GET /audit-logs/entity/:entityType/:entityId
```

## UI Filters

- actor
- role
- action
- entity type
- entity ID
- date range

## Completion Criteria

Phase 10 is complete when Super Admin can inspect important system activity.

---

# Recommended First Frontend Milestone

Build only these first:

```text
Phase 0: App shell and shadcn/ui setup
Phase 1: Login and role-based layout
Phase 2: Super Admin setup screens
```

That gives you the required foundation to create users, teams, and territories before customer, order, invoice, and collection workflows.

## First Milestone Pages

```text
/login
/dashboard

/users
/users/new
/users/[id]
/users/[id]/edit

/teams
/teams/new
/teams/[id]
/teams/[id]/members

/territories
/territories/new
/territories/[id]
/territories/[id]/assignments
```

## Do Not Build Yet

Do not build these before Phase 0–2 are stable:

```text
GPS screens
Sales Executive screens
Logistics screens
Mobile-specific screens
AI recommendations
WhatsApp flows
Inventory management
```

---

# Frontend Engineering Principles

## 1. Use server-side auth checks where possible

Protected dashboard routes should validate authentication before rendering sensitive UI.

## 2. Hide UI by role, but do not trust it

The frontend can hide menu items, buttons, and pages based on role.

The backend must still enforce permission.

## 3. Keep forms schema-driven

Use Zod schemas shared or aligned with backend validation wherever practical.

## 4. Use consistent table patterns

Most CRM pages should use the same pattern:

```text
Page header
Search/filter bar
Data table
Row actions
Create button
Pagination
```

## 5. Use detail pages for operational context

For example, Customer Detail should eventually show:

```text
Profile
Assignments
Contacts
Documents
Orders
Invoices
Outstanding
Collections
Approvals
Audit timeline
```

## 6. Keep dashboards separate from CRUD

Do not overload CRUD list pages with dashboard logic.

Use dedicated dashboard endpoints and dashboard pages.

## 7. Prefer progressive build

Build working vertical slices instead of creating empty pages for all modules.

---

# Summary

The Next.js frontend should start as a CRM-style operational dashboard for:

```text
Super Admin
Manager
Accountant
```

The first practical build target is:

```text
Login
Role-based dashboard shell
Super Admin user/team/territory setup
```

After that, build:

```text
Customers
Invoices
Collections
Manager dashboard
Super Admin control tower
Rules and approvals
Incentives
Audit logs
```
