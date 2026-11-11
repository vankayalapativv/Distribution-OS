# Data Flow

## Sales-to-Collection Flow

```text
Sales Executive creates order
        ↓
Manager/Super Admin approval if configured
        ↓
Invoice PDF uploaded
        ↓
Invoice record created
        ↓
Outstanding amount created
        ↓
Sales Executive records collection
        ↓
Payment proof uploaded
        ↓
Accountant verifies payment
        ↓
Collection allocated/reconciled against invoice
        ↓
Outstanding recalculated
        ↓
Aging recalculated
        ↓
Alerts/KPIs/incentives recalculated
```

## Logistics Fulfilment Flow

```text
Driver logs in
        ↓
Selects vehicle number
        ↓
Selects destination/region
        ↓
Inputs starting odometer reading
        ↓
Starts journey
        ↓
System tracks GPS every 5 minutes
        ↓
Driver visits each customer
        ↓
Delivery proof photo uploaded per delivery
        ↓
Driver moves to next customer
        ↓
After last delivery, returns to branch/office
        ↓
Inputs ending odometer reading
        ↓
Submits fulfilment trip
        ↓
Trip distance, delivery completion, and exceptions are finalized
```

## GPS Flow

GPS tracking happens continuously every 5 minutes only between login/logout or journey start/end.

## Rule Execution Flow

```text
Business action attempted
        ↓
API loads active rules
        ↓
Rules are evaluated
        ↓
Allowed / blocked / requires approval / warning
        ↓
Audit log recorded
        ↓
Related alert or approval created if needed
```
