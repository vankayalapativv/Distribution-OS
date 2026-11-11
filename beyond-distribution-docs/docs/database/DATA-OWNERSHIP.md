# Data Ownership and Visibility

## Sales Executive

A Sales Executive can see:

- currently assigned customers
- own visits
- own GPS logs
- own orders
- collections they recorded
- invoices/outstanding for assigned customers
- own KPI

Historical rule:

- If a customer is reassigned, the previous Sales Executive retains visibility only to historical interactions they personally performed.

## Manager

A Manager can see data for:

- assigned teams
- assigned territories
- executives under those teams/territories
- customers in those assignments
- team KPI
- team visits/orders/collections

## Accountant

An Accountant can see:

- invoices
- collections
- payment proof
- reconciliation status
- aging data
- outstanding data

Accountant should not automatically receive operational control over sales territories or logistics.

## Logistics

A Logistics user can see:

- assigned vehicle/journey data
- assigned invoice/order fulfilment records
- delivery stops
- delivery proof
- own trip GPS logs

## Super Admin

Super Admin can see and configure everything for the business.

## Database Enforcement Strategy

Application-level authorization in Hono is mandatory.

Recommended checks:

```text
1. Validate Neon Auth user
2. Load business user profile
3. Load roles
4. Resolve data scope
5. Apply module permission
6. Apply row/data ownership filter
7. Execute business action
8. Write audit log
```

Future SaaS path:

- add organization-level scoping everywhere
- add organization owner role
- separate platform admin from organization owner
