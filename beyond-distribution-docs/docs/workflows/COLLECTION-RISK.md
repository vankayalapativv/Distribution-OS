# Collection Risk & Aging Flow

## Purpose

Tracks invoice aging and collection risk.

## Flow

```text
Read invoice outstanding data
        ↓
Calculate aging days
        ↓
Assign aging bucket
        ↓
Check risk policy
        ↓
Create alerts/escalations
        ↓
Generate recovery list
```

## Key Tables

- invoices
- collections
- collection_allocations
- aging_snapshots
- alerts
- rule_executions

## Configurable Rules

- aging buckets
- critical overdue threshold
- escalation threshold
- customer block threshold
- incentive disqualification threshold
