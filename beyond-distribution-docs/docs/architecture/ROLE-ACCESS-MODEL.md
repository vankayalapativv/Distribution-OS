# Role Access Model

## Roles

```text
SALES_EXECUTIVE
LOGISTICS
ACCOUNTANT
MANAGER
SUPER_ADMIN
```

## Super Admin

Super Admin is the business owner/admin for the client.

### Can Manage

- users
- roles
- teams
- territories
- rule configuration
- approvals
- incentive settings
- dashboards
- customer approval rules
- credit and incentive policy
- workflow rules

### Data Scope

Full business scope.

## Manager

Manager controls execution and performance.

### Can Manage

- one or more teams
- one or more territories
- assigned executives
- team performance
- customer approvals if configured
- beat/visit review
- escalations

### Data Scope

Manager can see only assigned teams and territories.

## Accountant

Accountant handles finance verification and reconciliation only.

### Can Access

- invoices
- collections recorded by sales executives
- payment proof
- collection allocation/reconciliation
- outstanding amounts
- aging reports
- payment verification status

### Cannot Access

Unless separately granted by Super Admin, Accountant should not manage:

- user roles
- territory assignment
- GPS control
- logistics trips
- sales incentive rules
- system configuration

## Sales Executive

Sales Executive is the field sales user.

### Can See

- customers currently assigned to them
- their own visits
- their own GPS history
- their own orders
- collections they recorded
- invoices and outstanding amounts only for their assigned customers
- their own KPI data
- their own incentive status, if enabled by Super Admin

### Historical Access Rule

If a customer is reassigned from Executive A to Executive B:

- Executive A keeps access to historical interactions they personally performed.
- Executive A should not keep full current customer portfolio visibility after reassignment.
- Executive B gets current operational visibility for the reassigned customer.

This requires historical tables to store `created_by`, `executive_id`, and immutable ownership fields.

## Logistics

Logistics user is the driver/fulfilment operator.

### Can Access

- assigned fulfilment trips
- vehicle selection
- journey start/end
- assigned invoices/orders for delivery
- delivery route/customers
- delivery photo proof
- odometer readings
- own GPS journey logs

### Cannot Access

- sales incentives
- all customer financial history
- full accountant reconciliation
- manager dashboards
- rule configuration
