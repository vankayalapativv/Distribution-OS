# KPI Dashboard Automation Flow

## Purpose

Pre-calculates dashboard metrics for fast reporting.

## Flow

```text
Collect source data
        ↓
Aggregate daily/periodic data
        ↓
Calculate KPIs
        ↓
Apply filters
        ↓
Store metric snapshots
        ↓
Render dashboards
```

## Key Tables

- executive_daily_metrics (as-built name: daily_executive_performance)
- manager_team_metrics
- territory_metrics
- customer_monthly_metrics
- collection_aging_snapshots

## KPI Sources

- sales
- collections
- visits
- GPS/KM
- customers
- invoices

## Notes

Dashboards should not always query raw transactional tables directly. Use snapshots/materialized metrics where needed.
