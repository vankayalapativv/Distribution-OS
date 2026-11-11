# Monthly Review Engine

## Purpose

Generates monthly review data for executives, managers, territories, and customers.

## Flow

```text
Month end trigger
        ↓
Aggregate data
        ↓
Calculate KPIs
        ↓
Rank executives
        ↓
Identify top/bottom performers
        ↓
Generate insights
        ↓
Create action plan
        ↓
Publish report
```

## Key Tables

- executive_daily_metrics (as-built name: daily_executive_performance)
- manager_team_metrics
- territory_metrics
- customer_monthly_metrics
- invoices
- collections
- visits
- alerts

## V1 Intelligence

No AI. Use deterministic summaries and configurable thresholds.
