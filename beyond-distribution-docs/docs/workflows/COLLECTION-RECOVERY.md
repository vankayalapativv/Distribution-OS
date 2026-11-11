# Collection Recovery Process

## Purpose

Helps Sales Executives collect payments and helps Accountants verify/reconcile collections.

## V1 Flow

```text
Outstanding customer identified
        ↓
Sales Executive visits/contact customer
        ↓
Collection recorded
        ↓
Payment proof uploaded
        ↓
Accountant verifies payment
        ↓
Collection allocated to invoice(s)
        ↓
Outstanding and aging recalculated
        ↓
Collection KPI updated
```

## Key Tables

- invoices
- collections
- payment_proofs
- collection_allocations
- reconciliation_logs
- aging_snapshots
- rule_executions

## Role Access

Sales Executive records collections and uploads proof. Accountant verifies collection and reconciles payment. Super Admin configures rules and views all.

## Configurable Rules

- payment proof required for non-cash modes
- cheque counts only after clearance
- collection incentive only after accountant approval
- overdue threshold
- critical alert after configured aging days
