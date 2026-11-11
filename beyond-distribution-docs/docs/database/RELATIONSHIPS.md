# Database Relationships

## Core Business Relationships

```text
Manager
  └── Teams
        └── Sales Executives
              └── Customer Assignments
                    ├── Visits
                    ├── Orders
                    ├── Collections
                    └── Invoices
```

## Customer Relationships

```text
customers
  ├── customer_contacts
  ├── customer_addresses
  ├── customer_documents
  ├── customer_assignments
  ├── orders
  ├── invoices
  ├── collections
  └── visits
```

## Order and Invoice Relationships

```text
orders
  └── order_items

invoices
  ├── invoice_items
  ├── invoice_documents
  └── collection_allocations
```

## Collection Relationships

```text
collections
  ├── payment_proofs
  ├── collection_allocations
  └── reconciliation_logs
```

Important: one collection can be allocated against multiple invoices, and one invoice can receive multiple collections.

## Logistics Relationships

```text
vehicles
  └── fulfilment_trips
        ├── fulfilment_trip_invoices
        ├── fulfilment_stops
        ├── delivery_proofs
        └── odometer_logs
```

## GPS Relationships

```text
gps_tracking_sessions
  └── gps_points
```

GPS sessions can belong to:

- Sales Executive daily login session
- Sales Executive route/visit session
- Logistics fulfilment journey

## Rule Relationships

```text
rule_definitions
  ├── rule_conditions
  ├── rule_actions
  └── rule_executions
```

## Approval Relationships

```text
approval_requests
  └── approval_actions
```

Approval requests can apply to:

- new customer approval
- order approval
- credit-related approval
- special incentive approval
- rule override
- exceptional collection handling
