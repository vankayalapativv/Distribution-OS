---
name: neon-http-driver-transactions
description: "API uses Neon HTTP driver — batch-only transactions; reconcile/opening-balance converge via recompute, not interactive txns"
metadata:
  node_type: memory
  type: reference
  originSessionId: 0b4435cc-5363-4ff4-b2d0-7af21abc73b5
  modified: 2026-10-04T19:38:48.650Z
---

`apps/api` uses the **`@neondatabase/serverless` HTTP driver** (`neon()` in `apps/api/src/lib/db.ts`), NOT the Pool/WebSocket driver. It supports transactions ONLY as the non-interactive **batch form** `sql.transaction([stmt1, stmt2, …])` (all statements sent together, one DB txn) — there is NO interactive `BEGIN` → run app logic on intermediate reads → `COMMIT`.

**Consequence (don't fight it):** multi-step financial flows that read→compute→write across steps CANNOT be wrapped in one transaction here. `verifyCollection`→`reconcileCollection`→`applyHeldCreditToOpenInvoices` and `upsertOpeningBalance`→`reReconcile` are therefore a chain of separate awaited calls that **converge via `recomputeCustomerBalances`** (the authoritative recompute, called after every mutation) rather than being atomic. Decided 2026-10-05: keep this design; do the driver-compatible batching instead of a stored function / Pool driver. To make a write atomic, generate the id in app code (`crypto.randomUUID()`) so dependent rows can reference it in ONE `sql.transaction([...])` — done for order+items, collection+allocation, and the opening-balance clear's two deletes.

**No Postgres stored functions or sequences exist** in the repo — all code generation (ORD-/COLL-/EXP-/CUST- = `max(substring)+1`) and money logic live in app TypeScript.

**Helper (2026-10-05):** `apps/api/src/lib/pg-errors.ts` exports `isUniqueViolation(err, constraint?)` and `retryOnUniqueViolation(fn, {constraint})`. Use the latter to guard race-prone `max(seq)+1` code generation (recompute + retry on the `*_code_key` collision) and the former to turn a concurrent clientUuid-replay collision into an idempotent "return existing" instead of a 500. Already applied to create order/collection/expenditure/customer.

**Ops note:** the health monitor's outage-alert recipient must be set via the `REPORTS_TO` Worker secret — the hardcoded personal-Gmail fallback was removed 2026-10-05, so with `REPORTS_TO` unset, alert emails are skipped (health history still records). Related: [[local-dev-uses-live-prod]].
