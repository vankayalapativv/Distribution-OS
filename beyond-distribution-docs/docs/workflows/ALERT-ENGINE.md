# Alert Engine Flow

## Purpose

Creates alerts from rules, workflow exceptions, GPS issues, overdue invoices, and performance risks.

## Flow

```text
Monitor event/data stream
        ↓
Apply configured rule
        ↓
Trigger alert
        ↓
Categorize severity
        ↓
Assign owner
        ↓
Track resolution
```

## Key Tables

- alerts
- alert_assignments
- alert_actions
- rule_definitions
- rule_executions

## Alert Types

- overdue invoice
- low sales
- low collection
- GPS off/missing
- route missed
- low productive calls
- customer risk
- pending payment verification
- fulfilment exception

## V1 Exclusion

No WhatsApp alerting in V1. Alerts stay inside the application dashboard.
