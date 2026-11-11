# Incentive Calculation Flow

## Purpose

Calculates Sales Executive incentives controlled by Super Admin.

## V1 Decision

Only Super Admin can choose/configure incentives for Sales Executives.

No retailer/customer incentive scope in V1 unless explicitly added later.

## Flow

```text
Sales and collection data collected
        ↓
Incentive rule selected by Super Admin
        ↓
Eligibility calculated
        ↓
Incentive amount calculated
        ↓
Super Admin approves
        ↓
Incentive appears in dashboard/report
```

## Key Tables

- sales_executive_incentive_plans
- sales_executive_incentive_ledger
- executive_daily_metrics (as-built name: daily_executive_performance)
- invoices
- collections
- collection_allocations
- approval_requests

## Configurable Rules

- sales target
- collection target
- minimum productive visits
- payment approval required
- cancelled invoice disqualification
- overdue disqualification threshold
- Super Admin approval requirement
