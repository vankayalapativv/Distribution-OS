---
name: user-deletion-removed
description: "User deletion removed entirely (2026-09-30); accounts are deactivated & reused, never destroyed — don't reintroduce a delete path"
metadata:
  node_type: memory
  type: project
  originSessionId: 7cfcb334-6117-46c9-8244-11746a5a70bf
  modified: 2026-09-30T17:32:21.661Z
---

On 2026-09-30 the ability to DELETE users was removed everywhere, by the client's
decision: no `DELETE /super-admin/users/:id` API endpoint, no `deleteSuperAdminUser`
service fn, no BFF route (`apps/web/src/app/api/admin/delete-user`), and no "Delete"
action in the Users & Teams UI (`super-admin-sections.tsx` / `super-admin-setup.tsx`).
Only **Edit** + **Set password** remain per user row.

To "remove" someone, set their `status` to **inactive** — that blocks login, frees the
billing seat (seat count = `count(*) from users where status='active'`), and keeps all
their history. Re-activate to reuse the account. Do not add a delete path back.

Relates to [[billing-seat-scaling-razorpay]] (deactivation is also how seat count goes down).
