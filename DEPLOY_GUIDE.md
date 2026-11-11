# Sri Aparajita — Deployment Guide (API + Web)

How to deploy the two server-side pieces of the Sri Aparajita Distribution
Management System, from a fresh machine to routine releases:

- **API** — Hono on **Cloudflare Workers** → `https://sri-aparajita-api.vardhansystems.workers.dev`
- **Web dashboard** — Next.js via **OpenNext** on a **Cloudflare Worker**
  (not Pages) → `https://sri-aparajita-web.vardhansystems.workers.dev`
- **Database** — **Neon** serverless PostgreSQL (shared by both, and by
  local development — there is one database)

For building the mobile APK see `apps/mobile/BUILD_GUIDE.md`.

---

## 1. One-time setup

### Prerequisites

```bash
node --version    # 20 LTS+
pnpm --version    # 10.x  (npm install -g pnpm)
pnpm install      # from the repo root — installs every workspace
```

### Cloudflare access

Deploys use `wrangler`, which is installed per-workspace (never global).
Authenticate once per machine:

```bash
cd apps/api
npx wrangler login          # opens the browser; use the Cloudflare account
npx wrangler whoami         # verify
```

### Database access

The Neon connection string lives in the **root `.env`** file (never
committed):

```bash
# /.env
DATABASE_URL='postgresql://<user>:<password>@<host>/neondb?sslmode=require&channel_binding=require'
JWT_SECRET=<same value as the API worker secret>
```

Get the connection string from the Neon console (or a teammate).

---

## 2. Database migrations

Migrations are plain SQL files in `packages/db/migrations/`, numbered
`0001…0015…`. They are written to be **idempotent** (`add column if not
exists`, `create table if not exists`) and are applied directly against
Neon — there is no migration runner or tracking table.

Apply a new migration with `psql` (or any Postgres client) using
`DATABASE_URL` from the root `.env`:

```bash
psql "$DATABASE_URL" -f packages/db/migrations/0015_market_intelligence.sql
```

Rules:

- **Apply migrations BEFORE deploying code that needs them.** The API
  and DB share one schema; old code + new schema is safe (columns are
  additive), new code + old schema is not.
- One database serves production **and** local development — a migration
  applied "for dev" is already live for production traffic. Write
  additive, backwards-compatible migrations only.
- Keep them idempotent so re-running is harmless.

---

## 3. Deploying the API (`apps/api`)

### 3.1 First-time resources (already done for this project)

These exist already — listed for disaster recovery / new environments:

```bash
cd apps/api

# R2 bucket for customer & market-intelligence photos (binding: PHOTOS)
npx wrangler r2 bucket create sri-aparajita-photos

# Secrets (values from the team / Neon console)
npx wrangler secret put DATABASE_URL     # Neon connection string
npx wrangler secret put JWT_SECRET      # HS256 signing secret for logins

npx wrangler secret list                 # verify — should show both
```

The non-secret config (name `api`, `nodejs_compat`, the `PHOTOS` R2
binding) is committed in `apps/api/wrangler.jsonc`.

### 3.2 Routine deploy

```bash
cd apps/api
npx vitest run              # all tests must pass
npx tsc --noEmit            # typecheck
npx wrangler deploy         # ~20s; prints the version id
```

### 3.3 Verify after deploy

```bash
# Health — service info JSON
curl -s https://sri-aparajita-api.vardhansystems.workers.dev/ | head -c 120

# Login path works end-to-end (200 expected with a valid test account)
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST https://sri-aparajita-api.vardhansystems.workers.dev/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<test-account>","password":"<password>"}'

# A protected route exists (401 = deployed & guarded; 404 = stale code)
curl -s -o /dev/null -w "%{http_code}\n" \
  https://sri-aparajita-api.vardhansystems.workers.dev/api/v1/tracking/executives
```

Live logs while testing: `npx wrangler tail api`.

### 3.4 Rollback

```bash
cd apps/api
npx wrangler deployments list           # find the previous version id
npx wrangler rollback                   # interactive rollback to a version
```

Rollback restores the previous **code** instantly; it does not undo
database migrations (which is why migrations must stay additive).

---

## 4. Deploying the Web dashboard (`apps/web`)

The Next.js app is compiled for Cloudflare by **OpenNext**
(`@opennextjs/cloudflare`) and deployed as the Worker **`sri-aparajita-web`**
with a static-assets binding. All the config is committed:

- `apps/web/wrangler.toml` — worker name, `main = .open-next/worker.js`,
  `[assets]` directory & binding (`run_worker_first = false` is what
  makes Workers-not-Pages the right model here)
- `apps/web/open-next.config.ts` — OpenNext adapter config
- `package.json` → `"deploy": "opennextjs-cloudflare build && wrangler deploy"`

### 4.1 First-time secrets (already set for this project)

```bash
cd apps/web
npx wrangler secret put SRI_APARAJITA_API_BASE_URL   # https://sri-aparajita-api.vardhansystems.workers.dev
npx wrangler secret put JWT_SECRET            # SAME value as the API's JWT_SECRET
```

`JWT_SECRET` must match the API's — the web server-side verifies the
same HS256 session tokens. `SRI_APARAJITA_API_BASE_URL` is how the deployed web
finds the deployed API (locally it falls back to `localhost:8787/8/9`).

### 4.2 Routine deploy

```bash
cd apps/web
npx tsc --noEmit            # typecheck (test-file matcher noise is known)
pnpm deploy                 # = opennextjs-cloudflare build && wrangler deploy
```

The OpenNext build takes a few minutes and ends with
`Worker saved in .open-next/worker.js 🚀`; wrangler then uploads worker
+ static assets.

> Historical gotcha: never create `apps/web/pnpm-lock.yaml`. A stale
> per-app lockfile once made Turbopack pick the wrong workspace root and
> fail the build. One lockfile at the repo root only.

### 4.3 Verify after deploy

1. Open `https://sri-aparajita-web.vardhansystems.workers.dev` → redirects to
   login (HTTP 307 is the healthy unauthenticated response).
2. Log in as Super Admin / a test Manager and spot-check:
   - Customers list loads (proves `SRI_APARAJITA_API_BASE_URL` + `JWT_SECRET`
     are right — these break as "fetch failed" or instant logouts).
   - Live Tracking page renders the map (self-hosted basemap — see 4.4).
3. `npx wrangler tail sri-aparajita-web` streams runtime errors if anything 500s.

### 4.4 Maps — self-hosted, no API key

The app uses **MapLibre GL with a self-hosted OpenStreetMap vector basemap**
(`vardhan-maps`, tiles on our Cloudflare R2) — **not** Google Maps. There is
**no maps API key** to set: `pnpm deploy` is all that's needed, and the
`prebuild`/`predev` step copies the MapLibre worker (`copy-maplibre-worker.mjs`)
so the render worker is served correctly on Cloudflare.

> Historical note: earlier builds used a Google Maps key
> (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`); that dependency was removed when the app
> moved to the self-hosted vector basemap. No Google key is required anywhere.

### 4.5 Rollback

Same as the API, from `apps/web`:
`npx wrangler deployments list` → `npx wrangler rollback`.

---

## 5. Release order (when everything changed)

1. **Migrations** → apply to Neon (`psql … -f packages/db/migrations/00XX…`)
2. **API** → `cd apps/api && npx vitest run && npx wrangler deploy` + verify
3. **Web** → `cd apps/web && pnpm deploy` + verify in the browser
4. **Mobile APK** (if mobile changed) → `apps/mobile/BUILD_GUIDE.md`
   (the APK bakes in the production API URL, so deploy the API first)

---

## 6. Quick reference

| Task | Command |
|------|---------|
| Login to Cloudflare | `cd apps/api && npx wrangler login` |
| Apply a DB migration | `psql "$DATABASE_URL" -f packages/db/migrations/00XX_name.sql` |
| Deploy API | `cd apps/api && npx wrangler deploy` |
| API secrets | `cd apps/api && npx wrangler secret list` / `secret put NAME` |
| Tail API logs | `cd apps/api && npx wrangler tail api` |
| Deploy web | `cd apps/web && pnpm deploy` |
| Web secrets | `cd apps/web && npx wrangler secret list` / `secret put NAME` |
| Tail web logs | `cd apps/web && npx wrangler tail sri-aparajita-web` |
| List/rollback deploys | `npx wrangler deployments list` / `npx wrangler rollback` |
