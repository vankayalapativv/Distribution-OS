# Audit Strategy

## Why Audit Logs Matter

This system includes money, credit, collections, approvals, incentives, and GPS tracking.
Every important write must be traceable.

## Audit Events to Capture

- user login/logout
- customer created/updated/approved/rejected
- order created/approved/rejected
- invoice uploaded/edited
- collection recorded
- payment proof uploaded
- accountant approval/rejection
- collection allocation changes
- rule configuration changes
- approval configuration changes
- incentive plan changes
- incentive payout approval
- fulfilment journey start/end
- odometer submission
- delivery proof upload
- GPS session start/end

## Audit Log Fields

Recommended fields:

```text
id
actor_user_id
actor_role
action
entity_type
entity_id
old_value_json
new_value_json
ip_address
user_agent
created_at
```

## Rule Execution Audit

Every configurable rule evaluation should record:

```text
rule_id
trigger_event
input_snapshot
result
action_taken
created_at
```

This helps debug why an order, approval, collection, visit, or incentive was blocked/allowed.
