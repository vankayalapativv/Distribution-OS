# GPS Tracking & Validation Flow

## Purpose

Tracks user movement for field execution and logistics.

## V1 Decision

GPS is captured continuously every 5 minutes during login-to-logout or journey start-to-end.

## Flow

```text
User logs in / starts journey
        ↓
GPS session created
        ↓
GPS point captured every 5 minutes
        ↓
GPS points stored
        ↓
Alerts generated if GPS disabled/missing
        ↓
Session ends on logout / journey end
```

## Key Tables

- gps_sessions (as-built name: gps_tracking_sessions)
- gps_points
- visits
- fulfilment_trips
- rule_executions
- alerts

## Configurable Rules

- GPS frequency
- GPS missing grace period
- GPS-off alert threshold
- geo-fence radius
- whether GPS is mandatory for visit count
- whether GPS is mandatory for trip completion

## Notes

GPS tables can grow quickly. Add indexes on user_id, session_id, and recorded_at.
