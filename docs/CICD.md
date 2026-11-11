# CI/CD Pipeline

Open-source pipeline on **GitHub Actions**, deploying to **Cloudflare Workers**
via **wrangler**. Nothing untested reaches `main`; nothing reaches production
without a green pipeline **and** a one-click human approval.

```
 PR / push to main
        │
        ▼
   ┌──────────────────────── CI (ci.yml) ────────────────────────┐
   │  verify:  no-import-cycles · typecheck · FULL test suite     │  ← all blocking
   │           (~2,500 tests: api+web+mobile+mcp) · lint          │
   │  gitleaks:        secret scan (blocking)                     │
   │  dependency-scan: known CVEs (report-only)                   │
   └─────────────────────────────────────────────────────────────┘
        │
        ▼  you click Actions → Deploy → Run workflow  (the approval gate)
   ┌──────────────────── Deploy (deploy.yml) ────────────────────┐
   │  verify:  re-runs cycles + typecheck + tests + lint          │  ← deploys only if green
   │  deploy:  1. DB migrations (incremental)                     │
   │           2. deploy API  (wrangler)                          │
   │           3. deploy web  (opennextjs + wrangler)             │
   └─────────────────────────────────────────────────────────────┘
```

**Why manual, not auto:** GitHub Environment required-reviewer approval isn't
available for **private repos on the free plan**. So instead of auto-deploying on
push, the Deploy workflow is **manual** — running it yourself is the approval
step, and it re-runs the full test/quality gate and deploys only if that passes.

## Workflows

| File | Trigger | Does |
|------|---------|------|
| `.github/workflows/ci.yml` | push + PR to `main` | Quality gate: typecheck, full test suite, lint (all blocking); gitleaks (blocking); dependency audit + **test coverage** (report-only — coverage numbers appear in the run's Summary). |
| `.github/workflows/deploy.yml` | **manual** (Actions → Deploy → Run workflow) | Re-verifies (cycles/typecheck/tests/lint), then runs migrations and deploys API then web. |

### Not enabled (free plan + private repo)
GitHub gates several governance/security features behind a paid plan for **private**
repos. On the current free plan these are **unavailable**, so they're not wired up:

- **Branch protection / rulesets** — can't require PRs + green checks before merging.
- **Environment required-reviewer approval** — so Deploy is manual instead (see below).
- **CodeQL / code scanning (SAST)** — needs GitHub Advanced Security; the analysis
  runs but can't upload results, so the workflow was removed.

To enable all three: upgrade to **GitHub Pro/Team** (private) or make the repo
**public**. Then re-add `codeql.yml` (in git history), apply branch protection,
and add a required reviewer to the `production` environment.

## One-time setup

### 1. Repository secrets
`Settings → Secrets and variables → Actions → New repository secret`:

| Secret | Value |
|--------|-------|
| `CLOUDFLARE_API_TOKEN` | A Cloudflare API token with the **Edit Cloudflare Workers** template. Create at dash.cloudflare.com → My Profile → API Tokens → Create Token. |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account id (dash → Workers & Pages → right sidebar, or `wrangler whoami`). |
| `DATABASE_URL` | The Neon connection string (same one in `.env`), used by the migration step. |

Runtime Worker secrets (e.g. `JWT_SECRET`, `NEON_AUTH_COOKIE_SECRET`, the API's
`DATABASE_URL`) are **already set on the Workers** via `wrangler secret put` and
persist across deploys — CI does **not** manage them.

### 2. Deploying (the approval gate)
Deploys are **manual**: `Actions → Deploy → Run workflow` (optionally enter a
branch/SHA; default `main`). That deliberate click is the approval — the workflow
re-runs the full gate and deploys only if it's green.

> A `production` environment exists (for deployment history), but required-reviewer
> approval isn't available for private repos on the free plan. If you upgrade to
> GitHub Pro/Team, you can add **Required reviewers** to that environment and
> switch `deploy.yml` back to an auto `workflow_run` trigger for a hands-off flow.

### 3. Branch protection (only after upgrading — see "Not enabled" above)
Not available on the free plan for a private repo. Once on GitHub Pro/Team (or if
the repo is public), apply it so nothing merges to `main` without a PR + green CI:
```bash
gh api -X PUT repos/:owner/:repo/branches/main/protection --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["verify", "Secret scan (gitleaks)"] },
  "enforce_admins": true,
  "required_pull_request_reviews": { "required_approving_review_count": 0 },
  "restrictions": null
}
JSON
```

## Database migrations

An incremental runner (`packages/db/src/migrate.ts`) tracks applied files in a
`schema_migrations` table and applies only new ones.

- **Already baselined:** the production DB has all 84 current migrations recorded,
  so the deploy's migrate step is a no-op until you add a new file.
- **Add a migration:** drop `packages/db/migrations/00NN_name.sql` (next number).
  The deploy runs it automatically before deploying code. Keep migrations additive
  and immutable once merged (the runner warns on drift).
- **Commands:**
  ```bash
  pnpm --filter @distribution-os/db run migrate            # apply pending
  pnpm --filter @distribution-os/db run migrate -- --status # show applied/pending
  ```

## Local pre-push checks (same as CI)

```bash
pnpm turbo run typecheck
pnpm turbo run test
pnpm turbo run lint
```

## Tuning

- **Secret scan false positives:** add a path to `[allowlist]` in `.gitleaks.toml`
  (never disable the whole scan).
- **Dependency audit** is report-only. To make it blocking, remove
  `continue-on-error: true` from the `dependency-scan` job and set the threshold
  (`--audit-level critical`).
- **Lint:** the React-Compiler-era `react-hooks/*` rules are set to **warn**
  (they flag many working patterns) in `apps/{web,mobile}` ESLint configs; real
  errors block CI. Build output dirs (`.open-next`, `.wrangler`, `dist`) are
  ignored so `eslint` doesn't OOM on bundled files.

## Deploying

`Actions → Deploy → Run workflow`. It re-verifies then deploys migrations →
API → web. Run it whenever you want to ship the current `main` (or a specific
SHA) to production.
