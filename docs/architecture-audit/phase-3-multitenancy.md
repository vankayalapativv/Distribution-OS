# Phase 3 — Multi-tenancy / SaaS Quantum (strategic)

**Lens:** the architecture quantum (Ch. 7) — the exact tool for tenancy. Getting tenant identity
into the architecture as a first-class concept is what makes a SaaS transition tractable. This is
the playbook's "highest-leverage" phase.

**Agreed handling:** audit the code **as it actually is** (single-client silo) and frame the SaaS
direction as a **conscious trade-off** (the book's core discipline), not assert a defect.

---

## 1. Current model: **single-tenant silo — with exactly one tenant**

| Question | Finding |
|----------|---------|
| Silo / pool / bridge? | **Silo.** One Worker + one Neon DB per customer deployment. |
| Tenant identity in schema? | **None.** 0 `tenant_id`/`organization_id` columns in 72 tables (Phase 0). `organizations` + all org columns were **deliberately dropped** (migrations 0034/0035) to simplify. |
| Tenant identity in auth? | **None.** `attachAuthContext` resolves Neon `sub` → `users.app_login_id` → `{userId, role, externalUserId}`. There is no tenant dimension to thread. |
| Pooled-query tenant filtering / RLS? | **N/A** — not pooled; nothing to leak *because there is only one tenant per DB.* No cross-tenant leak risk exists today. |
| Per-tenant config source | **Mostly hardcoded.** `system_settings` holds only **2 keys** (`credit_overdue_days`, `operating_area`). Branding, catalogue, invoice format, emails, and the R2 bucket are baked into code/env. |
| Provisioning | **Fully manual** (see §3). |
| Migration propagation | **No runner, no tracking table** — each of 79 migrations is applied by hand via `psql -f`. Prod **and** dev share **one** DB (DEPLOY_GUIDE §2). |

**So there is no tenant-isolation defect to fix** — isolation is currently provided by physical
DB separation per deploy, the strongest form. The real question is entirely strategic: **what does
onboarding customer #2 cost, and which road do you want?**

---

## 2. The strategic trade-off (this is the decision, not a bug)

The playbook assumes *"per-customer today, moving to SaaS."* The code went the other way on
purpose (priorities #5 cost, #6 simplicity). Three roads, per §2 of the playbook:

| Road | What it is | Isolation | Onboarding cost | Code complexity | Reverses the 0034/0035 simplification? |
|------|-----------|-----------|-----------------|-----------------|----------------------------------------|
| **A. Silo, done well** | Keep DB-per-deploy; automate provisioning + config | Strongest | Run a script + set env | **Lowest** (no request-path change) | No |
| **B. Bridge** | One shared Worker; DB-per-tenant via Neon projects/branches; resolve tenant → connection string early | Strong | Insert tenant + provision its DB | Medium (tenant→DB routing + migration fan-out) | Partly |
| **C. Pool** | One shared DB; `tenant_id` on every row + Postgres RLS | Weakest (leak risk) | Insert a row | **Highest** (re-add `tenant_id` everywhere + RLS) | **Fully** (undoes 0034/0035) |

### The key insight (what makes this cheap to decide)

**Road A's enabling work is a prerequisite for Road B anyway.** Both need: (1) client-specific
values extracted from code into config, (2) a real migration runner, (3) an automated provisioning
script. Road B then adds only *tenant → database routing* in the request pipeline — a single clean
seam, exactly the architecture-quantum boundary Ch. 7 endorses. Neon's cheap projects/branches
make Bridge the natural SaaS evolution from today.

**Road C (pool)** is the most invasive: it re-introduces the `tenant_id` that was deliberately
removed, touches all 72 tables and every query, and trades your strongest isolation for the
weakest. Per the book, distribute/complicate only for a real reason — pool is only worth it at a
scale (many small tenants sharing hardware) you are nowhere near.

### Recommendation (framing, not a decision you have to take now)

Do **Road A's enabling work now** (it pays off even if you never go SaaS — it makes *this* client
safer and future clients a script away), keep the **Bridge** seam in mind, and **do not** reach
for **Pool** until real SaaS demand justifies undoing the simplification. This keeps priorities
#5/#6 intact while buying optionality on #4 cheaply — the book's "last responsible moment" for the
expensive, irreversible decision.

---

## 3. Provisioning & the "cheap now vs. expensive later" list

Onboarding a new customer **today** requires, by hand: create a Neon DB → apply 79 migrations
one-by-one via `psql` → deploy a Worker with per-client env (DATABASE_URL, R2 bucket, from-emails,
VAPID, geocoding key) → run `setup` (currently broken, see G-0304) → seed catalogue → set
`system_settings` → **edit ~40 source files** to swap branding. That last step means **every new
client is a code fork** — the single biggest thing standing between you and SaaS, and the cheapest
to fix now.

**Cheap-now / expensive-later items** (each a gap row):

- **G-0302 — Extract hardcoded client identity into config.** "Distribution OS" appears in 37 files,
  "distributionos" in 5; only 2 `system_settings` keys exist. Branding, catalogue, invoice (BAL)
  format, emails, and R2 bucket are code/env-baked. Pull them into a config table / branding
  file / env so a new client needs **zero code edits**. *High — this is the SaaS gate, and it
  improves the single-client build too.*
- **G-0303 — Add a migration runner + tracking table.** No runner exists; 79 migrations are manual
  and untracked, and **prod + dev share one DB**. Without a runner, N tenants = N×79 hand-applied
  files. A runner is cheap now, and separating prod/dev DBs removes a real present-day risk
  (a dev migration hitting production). *High.*
- **G-0304 — Fix the provisioning script.** `packages/db/src/setup.ts` still PBKDF2-hashes and
  writes `password_hash`, a column **dropped in migration 0077** (auth moved to Neon). `pnpm setup`
  would fail or write a dead column — there is no working automated onboarding path. *Medium.*
- **G-0305 — "beyond" re-client leftovers.** The prior brand still appears in 9 files
  (`opening-balance-fifo.ts`, `result-screens.tsx`, `hero-card.tsx`, `settings-sections.tsx`,
  `icon.svg`, + tests). Symptom of branding-by-find/replace; folds into G-0302. *Low.*
- **G-0301 — No tenant seam in the identity object (strategic).** Even staying single-client, adding
  a `tenant`/`client` field to the resolved auth identity now (a constant today) creates the seam
  Road B would route on, avoiding a pipeline-wide retrofit later. Very cheap now. *Medium (strategic,
  decision-gated — only worth doing if SaaS is a real intention).*

---

## 4. Answer to the playbook's direct questions

- **Model today:** silo, single tenant, no tenant identity.
- **Tenant identity resolved once and passed down?** There is none to resolve — it would be a new
  concept. The auth pipeline (`attachAuthContext`) is the right place to add it if you go SaaS.
- **Pooled queries missing a filter?** None — not pooled. **No cross-tenant leak risk today.**
- **RLS?** Not applicable today; would be mandatory under Road C (pool).
- **Per-tenant config/provisioning:** minimal config table + heavy hardcoding; manual provisioning.
- **Migrations across N DBs:** no mechanism — the #1 mechanical blocker to silo/bridge SaaS.
- **Blocking the SaaS move, cheap now vs. expensive later:** G-0302 (config extraction) and G-0303
  (migration runner) are the cheap-now unlocks; G-0301 (pool's `tenant_id` everywhere) is the
  expensive-later one to defer.

---

## Coverage (ledger) update

Reviewed & marked `[x]`: `apps/api/src/middleware/auth.ts`, `packages/db/src/setup.ts`,
`packages/db/src/index.ts`. Non-ledger reviewed: `DEPLOY_GUIDE.md` §2, live `system_settings`.
No cross-tenant data-leak findings (single-tenant per DB) — the phase's Critical trigger does not
fire here.
