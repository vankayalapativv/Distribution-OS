# Schema Overview

## Major Database Domains

```text
1. Identity & Access
2. Team and Territory Management
3. Customer Management
4. Visit and GPS Tracking
5. Orders and Invoices
6. Collections and Reconciliation
7. Logistics Fulfilment
8. Rules and Approvals
9. KPI and Performance Metrics
10. Incentives
11. Audit and Events
```

## Identity & Access

Expected tables:

- users
- roles
- permissions
- user_roles
- teams
- team_members

Neon Auth should own authentication identity. The application database should own business profile, role, reporting, team, and access scope.

## Team and Territory Management

Expected tables:

- territories
- territory_assignments
- beats
- beat_customers
- beat_plans
- beat_plan_stops

Managers can control one or more teams and territories.

## Customer Management

Expected tables:

- customers
- customer_contacts
- customer_addresses
- customer_documents
- customer_assignments
- customer_status_history
- customer_credit_profiles

Sales Executives see currently assigned customers, but retain access to historical interactions they personally performed.

## Visit and GPS Tracking

Expected tables:

- visits
- visit_outcomes
- visit_photos
- gps_sessions (as-built name: gps_tracking_sessions)
- gps_points

GPS points are captured every 5 minutes between login/logout or journey start/end.

## Orders and Invoices

Expected tables:

- orders
- order_items
- invoices
- invoice_items
- invoice_documents

V1 invoice source is PDF upload.

## Collections and Reconciliation

Expected tables:

- collections
- payment_proofs
- collection_allocations
- reconciliation_logs

Accountant verifies and reconciles collections recorded by Sales Executives.

## Logistics Fulfilment

Expected tables:

- vehicles
- fulfilment_trips
- fulfilment_trip_invoices
- fulfilment_stops
- delivery_proofs
- odometer_logs

Logistics workflow is journey-based, not inventory-ledger-based in V1.

## Rules and Approvals

Expected tables:

- rule_definitions
- rule_conditions
- rule_actions
- rule_executions
- approval_requests
- approval_actions

Super Admin configures business rules.

## KPI and Performance Metrics

Expected tables:

- executive_daily_metrics (as-built name: daily_executive_performance)
- manager_team_metrics
- customer_monthly_metrics
- territory_metrics
- collection_aging_snapshots

## Incentives

Expected tables:

- sales_executive_incentive_plans
- sales_executive_incentive_ledger

Only Super Admin chooses and controls Sales Executive incentives in V1.

## Audit and Events

Expected tables:

- audit_logs
- domain_events
- alerts
