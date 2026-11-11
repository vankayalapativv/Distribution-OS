# Phase 1 — Modularity, Coupling & Components

**Lens:** cohesion and coupling per Ch. 3 & 8 — the direct levers for maintainability (#1) and
feature velocity (#2). Method: a static import-graph analysis over every intra-package relative
import (fan-in/fan-out, Tarjan SCC cycle detection) plus targeted reads of the hotspots.

Analyzer: `scratchpad/graph.mjs` (afferent/efferent + SCC). Ran on `apps/api/src` (203 files).
Frontend structure reviewed by directory/partition + contract inspection.

---

## Summary scorecard

| Dimension | Verdict |
|-----------|---------|
| Import cycles (backend) | **1** cycle in 203 files — excellent hygiene, but it crosses a layer boundary |
| Business logic in route handlers | **3 / 68** route files hold inline SQL — routes are otherwise thin (good) |
| Afferent hotspots | All are **stable infrastructure** (`lib/db`, `lib/errors`, `types`) — healthy, not a smell |
| Top-level partitioning | **Inconsistent:** web = domain (good); backend + mobile = technical |
| Shared contracts | **`packages/shared` is empty & unused** — API types duplicated across api/web/mobile |
| Connascence of meaning | Role codes hardcoded **834×** across the 3 apps |
| God files | 4 service files > 900 LOC (orders 1795, customers 1603, collections 1022, invoices 902) |
| Mobile cohesion | `lib/` is **178 flat files** (5 subdirs) — navigability smell |

---

## What's genuinely good (record strengths, not just gaps)

- **Very low backend coupling:** only **one** import cycle across 203 files; no 2-node cycles.
  The `routes → services → lib` flow is consistent and one-module-per-resource.
- **Routes are thin:** 65/68 route files contain no SQL; they parse, authorize, and delegate to
  services. Business logic lives in the service layer, as it should.
- **Afferent hotspots are the right ones:** `lib/db.ts` (133 fan-in), `lib/errors.ts` (68),
  `types.ts` (64), `lib/api-response.ts` (48), `lib/authz.ts` (45). Per Ch. 3, wide fan-in on
  *stable* infrastructure is healthy (Stable Dependencies Principle), not a coupling defect.
- **Web is close to the "ideal":** domain-partitioned `features/<capability>/`, with a shared
  feature-kit (`components/data-table`, `components/form`, `lib/api-client`) — high cohesion,
  low duplication. `lib/` is only 14 files (no dumping ground).
- **API has a `Role` union** (`types.ts`) giving compile-time safety on typed role positions.

---

## Findings (→ gap report)

### G-0101 · Cross-layer import cycle (`lib` depends on `services`) — Medium
`lib/errors.ts` (line 4) imports `captureError` from `../services/errors`, while
`services/errors.ts` imports `SqlClient` from `../lib/db` and `lib/db.ts` imports `ApiError`
from `./errors` — forming the cycle `lib/db → lib/errors → services/errors → lib/db`.
Infrastructure (`lib/`) should not depend on business logic (`services/`). The `services/errors`
edge is type-only (erased at runtime), so it doesn't break the bundle today, but it is a genuine
**directional coupling / connascence-of-position** smell that will bite if `captureError` grows
runtime deps. *Ch. 3 (coupling, acyclic dependencies).*

### G-0102 · Empty, unused `packages/shared` → API contracts duplicated across 3 apps — High
`packages/shared/src/index.ts` is **0 lines** and imported by **nothing** (0 references in apps).
The intended shared type/contract layer is dead, so request/response contracts are re-declared
in each codebase (**94 local type defs across 25 web `*-api.ts` files** alone, plus mobile's own).
This is **connascence of type + meaning across the architecture quanta** (Ch. 3, 7): change an
API response shape and you must manually hunt the matching type in web *and* mobile. Directly
taxes maintainability (#1) and feature velocity (#2).

### G-0103 · Pervasive role-code string connascence — Medium
Role literals (`"SUPER_ADMIN"`, `"SALES_EXECUTIVE"`, …) appear **834×** across the apps
(api 495, web 324, mobile 15). The API's `Role` union limits typo risk in typed positions, but
there is no single source of truth for the role set, especially across apps. Renaming/adding a
role is a distant, many-site change — **connascence of meaning/value** (Ch. 3). Best fixed
together with G-0102 (a shared `roles` constant + `Role` type).

### G-0104 · God-files in the service layer — Medium
Four service files exceed 900 LOC: `services/orders.ts` (1795), `services/customers.ts` (1603),
`services/collections.ts` (1022), `services/invoices.ts` (902). Each is domain-cohesive (all
"orders" logic, etc.), so this is *weak* cohesion-by-size rather than a grab-bag, but 1795 LOC
is beyond what a solo maintainer can hold in working memory — a maintainability drag (Ch. 3).

### G-0105 · Mobile `lib/` is a 178-file flat directory — Medium
`apps/mobile/src/lib/` holds **178 files directly** (only 5 subdirs). Many are cohesively named
(`gps-*`, `sync-*`, `auth-*`), but a flat 178-file folder mixing infrastructure, domain hooks,
and utilities is low navigational cohesion (Ch. 3) and a simplicity tax (#6) for a solo dev.

### G-0106 · Inline SQL in 3 route handlers (thin-route leak) — Low
`routes/invoicing-pdf.ts`, `routes/me.ts`, `routes/system-settings.ts` contain `sql\`\`` directly
in the handler instead of delegating to a service. Minor and localized (routes are otherwise
clean), but it erodes the routes-are-thin convention.

### G-0107 · Backend top-level partitioning is technical, not domain — Medium (strategic)
`apps/api/src` is split `routes/` · `services/` · `middleware/` · `lib/` — a **technical**
partition (Ch. 8). The book (and this playbook's "ideal") prefer **domain** partitioning at the
top level (e.g. `orders/`, `customers/`, `billing/` each owning their route+service+types). The
current scheme is consistent and easy to navigate, and the web app already demonstrates the
domain style — so this is the clearest structural divergence from "ideal," but also the most
expensive to change. Flag as a **conscious trade-off**, not an urgent defect.

---

## Coverage (ledger) update for Phase 1

Phase 1 reviewed the **whole backend at the component/graph level** (all 203 `apps/api/src`
files analyzed for imports/cycles) and inspected frontend partitioning + contracts structurally.
Files **read in depth** this phase are marked `[x]` in the ledger: `apps/api/src/index.ts`,
`lib/db.ts`, `lib/errors.ts`, `services/errors.ts`, `lib/authz.ts`, `types.ts`, the four god
services, and `packages/shared/src/index.ts`. Per-file line-by-line review of the remaining
feature files continues in the domain-specific phases (3–6); Phase 1's contract was
component-level coupling, which is complete across the repo.
