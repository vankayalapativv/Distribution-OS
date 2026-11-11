# Approval Rules

All approvals should be configurable from Super Admin UI.

Possible approval triggers:

- new customer approval
- order approval
- risky customer order
- credit limit change
- collection exception
- payment rejection correction
- incentive approval
- logistics trip exception

Recommended approval model:

```text
approval_requests
approval_actions
approval_status_history
```
