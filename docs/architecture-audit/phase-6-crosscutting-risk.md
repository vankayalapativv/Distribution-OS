# Phase 6 — Cross-cutting Concerns & Risk

**Lens:** Ch. 4 (cross-cutting concerns are where a monolith stays clean or rots) + Ch. 20
(risk storming). For a multi-customer product, tenant isolation is a *security* property — here,
with one tenant per DB, that maps to **Sales-Executive data-scoping** (an SE must not reach another
SE's customers/data). This phase is non-negotiable.

---

## Posture scorecard

| Concern | Verdict |
|---------|---------|
| Auth centralized | ✅ `requireRole`/`requireAuth` in **44/46** route files; the 2 without are `health` + `status` (correctly public) |
| Authentication | ✅ Neon Managed Auth, EdDSA JWT verified via JWKS in one place (`middleware/auth.ts`) |
| SE data-scoping | ✅ Applied — `assertCustomerVisible(sql, {userId, role}, customerId)` on SE branches (orders, collections, …) — but **convention-enforced, not structurally guaranteed** |
| SQL injection | ✅ **No surface** — all queries are Neon parameterized tagged templates; no `sql.unsafe`, no string concatenation |
| Input validation | ⚠️ Ad-hoc — manual `requiredString`/bounds checks; no schema layer (no Zod). Injection-safe, but semantic validation is inconsistent |
| Secrets | ✅ None hardcoded; `.env` gitignored; all via `c.env.*` |
| Error leakage | ✅ Unknown errors return generic `"An unexpected error occurred."` + 500; stack captured **server-side only** (`error_events`), never sent to clients |
| Observability | ✅ Reasonable — `X-Request-Id` threading, `timing()` middleware, persistent `captureError → error_events/error_groups`; only 3 `console.*` in services |

**This is a genuinely solid security/cross-cutting posture for a solo-dev product** — centralized
authz, injection-safe data access, no secret leakage, non-leaky errors, and real SE scoping.

---

## Findings (→ gap report)

### G-0601 · SE data-scoping is convention-enforced, not structurally guaranteed — High
`assertCustomerVisible` is called **manually inside each SE-reachable handler** (verified present
on orders and collections by-id/list paths). It works today, but nothing *forces* a new
SE-reachable endpoint to include it — no shared middleware, and (Phase 2) **no test** asserting an
SE cannot read another SE's record. Because isolation is a security property (Ch. 4), it should be
guaranteed, not remembered. **No current hole was found on the endpoints checked** — this is a
regression-risk finding. Fix: add a fitness-function test (SE-A cannot read SE-B's order/customer/
collection by id → 404) covering every SE-reachable by-id route, and consider a scoping helper the
handlers must pass through.

### G-0602 · No systematic input validation at trust boundaries — Medium
Validation is manual and per-field (`requiredString`, ad-hoc bounds like the battery/coordinate
checks). There is no schema-validation layer (no Zod) at the API boundary. SQL injection is not a
risk (everything is parameterized), but semantic bad data (out-of-range amounts, invalid enum
values, malformed payloads) can pass unevenly. A shared request-schema layer would make validation
uniform and self-documenting — and, in `packages/shared`, double as the typed contract (G-0102).

---

## Risk storming (Ch. 20) — likelihood × impact

| Risk | Likelihood | Impact | Rating | Root / ref |
|------|-----------|--------|--------|-----------|
| **Data loss/corruption via migration** — prod & dev share ONE Neon DB; manual `psql`, no runner/tracking | Medium | High | **🔴 Top risk** | G-0303 |
| **Partial financial write** — order-items / collection-allocations inserted via non-atomic N+1 loops; mid-loop failure leaves an inconsistent order/ledger | Medium | High | 🔴 High | G-0402, G-0403 |
| **SE cross-scope data exposure** — scoping is convention-enforced; a future endpoint could omit it | Low–Med | High | 🟠 High | G-0601 |
| **Regression reaches prod** — no CI gate runs the 516 tests/lint | Medium | Medium | 🟠 Medium | G-0201 |
| **Cost blowout** — N+1 + uncached auth queries, no query budget | Low–Med | Medium | 🟡 Medium | G-0401, G-0404 |
| **Auth bypass** — centralized Neon EdDSA + JWKS | Low | High | 🟡 Medium | — (well-controlled) |
| **Secret exposure** — `.env` gitignored, none hardcoded, but 28 vars undocumented | Low | High | 🟡 Low–Med | G-0502 |
| **Cross-tenant leak** (multi-customer) | N/A today | — | ⚪ N/A | single tenant per DB |

**The two risks that most deserve action** are both already filed and are *not* about adding
features: **(1) separate prod/dev DBs + a migration runner (G-0303)** — the highest impact×likelihood
cell — and **(2) make the financial writes atomic (G-0402/0403)**. Neither is a big project; both
remove a High-impact risk.

---

## Answers to the playbook's direct questions

- **Auth/authz centralized?** Yes — one verification path, `requireRole` on 44/46 routes.
- **Authorization includes tenant scope?** Single tenant; the SE-scope equivalent is present but
  convention-enforced (G-0601).
- **Input validation at boundaries?** Parameterized (injection-safe) but ad-hoc semantically (G-0602).
- **Secrets safe?** Yes — gitignored, no hardcoding.
- **Errors leak internals/other data?** No — generic client message, server-side capture only.
- **Observability enough to debug one tenant in prod?** Reasonable — requestId + persistent error
  store; a single tenant means no per-tenant filter is needed today.

---

## Coverage (ledger) update

Reviewed & marked `[x]`: `apps/api/src/lib/errors.ts`, `apps/api/src/middleware/request-context.ts`,
`apps/api/src/routes/orders.ts`, `apps/api/src/routes/collections.ts`. `middleware/auth.ts`,
`lib/authz.ts`, `services/customers.ts` already marked. Injection/secret scans covered all of
`apps/api/src` and `apps/*/src` (grep-level), recorded as reviewed-for-this-lens.
