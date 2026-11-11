# Executive Daily Workflow

## Purpose

Controls the daily field workflow of a Sales Executive.

## V1 Flow

```text
Login with Neon Auth
        ↓
Start work session
        ↓
GPS session starts
        ↓
GPS point captured every 5 minutes
        ↓
Load assigned customers / beat plan
        ↓
Executive visits customers
        ↓
Records sales order, collection, notes, or visit outcome
        ↓
Check-out / next customer
        ↓
End day / logout
        ↓
GPS session ends
        ↓
Daily KPI recalculated
```

## Role

Primary role: Sales Executive

## Data Scope

Sales Executive sees only assigned customers, own visits, own GPS logs, own orders, collections recorded by them, invoices/outstanding for assigned customers, and own KPI.

## Key Tables

- users
- customer_assignments
- visits
- gps_sessions (as-built name: gps_tracking_sessions)
- gps_points
- orders
- collections
- executive_daily_metrics (as-built name: daily_executive_performance)

## Configurable Rules

- GPS required for counted visit
- minimum visit duration
- productive visit definition
- daily visit target
- daily productive call target
- late login threshold
- GPS missing alert threshold
