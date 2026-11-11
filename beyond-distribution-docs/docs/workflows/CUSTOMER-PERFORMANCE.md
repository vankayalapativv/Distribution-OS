# Customer Performance Analytics Flow

## Purpose

Measures customer value, trend, risk, and status.

## Flow

```text
Collect customer transactions
        ↓
Aggregate sales, collections, visits
        ↓
Calculate metrics
        ↓
Compare with previous period
        ↓
Classify customer
        ↓
Assign/update score
        ↓
Update dashboard
```

## Key Tables

- customers
- invoices
- collections
- visits
- customer_monthly_metrics
- customer_scores

## Metrics

- sales value
- litres sold
- outstanding amount
- payment delay
- visit frequency
- order frequency
- collection percentage
- trend vs previous period

## V1 Intelligence

No AI. Use deterministic metrics and configurable thresholds.
