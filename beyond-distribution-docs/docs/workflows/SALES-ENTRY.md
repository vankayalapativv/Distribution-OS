# Sales Entry Process

## Purpose

Allows a Sales Executive to record customer sales activity and create orders.

## V1 Flow

```text
Select assigned customer
        ↓
Discuss requirement
        ↓
Create order
        ↓
Add order items
        ↓
Validate against rules
        ↓
Submit order
        ↓
Approval required if configured
        ↓
Order moves to invoice/upload/fulfilment workflow
```

## Key Tables

- customers
- orders
- order_items
- rule_executions
- approval_requests
- audit_logs

## Role Access

Sales Executive can create orders for assigned customers only.

Manager/Super Admin can review team/business orders based on permission.

## Configurable Rules

- block order for inactive customer
- require approval for risky customer
- require approval above value threshold
- require approval for overdue customer
- require minimum order value/litre threshold
