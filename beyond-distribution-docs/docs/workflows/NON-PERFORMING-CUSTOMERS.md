# Non-Performing Customer Detection

## Purpose

Detects weak, declining, dormant, or high-risk customers.

## Flow

```text
Read customer database
        ↓
Check last order date
        ↓
Check sales trend
        ↓
Check visit frequency
        ↓
Check payment delay
        ↓
Apply configured rules
        ↓
Flag customer
        ↓
Generate alert/recovery action
```

## Key Tables

- customers
- invoices
- collections
- visits
- customer_scores
- alerts
- rule_executions

## Configurable Rules

- no order for X days
- sales decline percentage
- no visit for X days
- payment delay threshold
- low conversion threshold
- weak customer score threshold
