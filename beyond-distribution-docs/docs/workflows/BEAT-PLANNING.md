# Beat Planning & Route Optimization

## Purpose

Plans which customers Sales Executives should visit.

## V1 Flow

```text
Customer list
        ↓
Segment by territory/beat
        ↓
Manager creates/approves plan
        ↓
Assign to Sales Executive
        ↓
Executive follows beat
        ↓
Track completion
```

## Key Tables

- territories
- beats
- beat_customers
- beat_plans
- beat_plan_stops
- visits

## Role Access

Manager can create plans for assigned teams/territories. Sales Executive can view assigned beat plans. Super Admin can configure beat rules.

## Configurable Rules

- visit frequency
- minimum productive calls
- high overdue priority
- high value customer priority
- route completion definition

## Note

No AI route optimization in V1.
