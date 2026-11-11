# Executive Behaviour Analytics

## Purpose

Measures Sales Executive execution quality.

## Flow

```text
Collect data
        ↓
Calculate sales, KM, collections, visits
        ↓
Apply rules
        ↓
Score executive
        ↓
Flag issues
        ↓
Update leaderboard/dashboard
```

## Key Tables

- visits
- gps_sessions (as-built name: gps_tracking_sessions)
- gps_points
- orders
- collections
- executive_daily_metrics (as-built name: daily_executive_performance)
- alerts

## Metrics

- total visits
- productive visits
- litres sold
- collection amount
- KM travelled
- sales per KM
- collection per KM
- new customers added
- visit quality score

## Configurable Rules

- high KM + low sales
- high visits + low conversion
- low collections
- low productive calls
- GPS missing
