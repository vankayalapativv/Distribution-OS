# Customer Onboarding Process

## Purpose

Creates and validates new customers.

## Flow

```text
Open new customer form
        ↓
Enter customer details
        ↓
Capture location
        ↓
Upload photos/documents
        ↓
Assign executive/territory
        ↓
Validate required fields
        ↓
Submit for approval if configured
        ↓
Approved customer becomes active
```

## Key Tables

- customers
- customer_contacts
- customer_addresses
- customer_documents
- customer_assignments
- approval_requests
- audit_logs

## Configurable Rules

- legal name required
- phone required
- territory required
- executive assignment required
- geo-location required
- signboard photo required
- GST mandatory for GST billing customers
- approval required before active status
