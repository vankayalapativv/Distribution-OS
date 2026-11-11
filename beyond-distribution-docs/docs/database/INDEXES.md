# Indexing Strategy

## High-Value Indexes

Add indexes for common filters:

```sql
-- ownership and scope
executive_id
manager_id
team_id
territory_id
customer_id

-- workflow status
status
approval_status
payment_status
fulfilment_status

-- dates
created_at
visit_date
invoice_date
due_date
collection_date
trip_date
```

## Sales Executive Queries

Common filters:

```text
assigned_executive_id = current_user.id
visit_date between X and Y
customer_id = X
```

## Manager Queries

Common filters:

```text
team_id in assigned_team_ids
territory_id in assigned_territory_ids
date range
```

## Accountant Queries

Common filters:

```text
payment_status
accountant_approval_status
due_date
aging bucket
customer_id
invoice_id
```

## Logistics Queries

Common filters:

```text
driver_user_id
vehicle_id
trip_status
trip_date
fulfilment_stop_status
```

## GPS Queries

Common filters:

```text
user_id
gps_session_id
recorded_at
```

GPS tables can grow quickly. Index carefully and consider retention policies later.
