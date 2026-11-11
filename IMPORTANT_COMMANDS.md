# Important Commands — Quick Reference

A cheat-sheet of the commands you run most often. Detailed guides:
`DEPLOY_GUIDE.md` (API + Web), `apps/mobile/BUILD_GUIDE.md` (APK), `docs/CICD.md`.

> Package manager is **pnpm only** — never `npm install` anywhere in this repo.

---

## Mobile — build the APK vs. push JS over the air (EAS Update)

The app uses **EAS Update (`expo-updates`)**. Rule of thumb:

- **Pure JS/TS change** (business logic, screens, date fixes) → **OTA, no rebuild**.
- **Native change** (new native module, permission/plugin change, Expo SDK bump)
  → **new APK**. The `runtimeVersion` `fingerprint` policy detects this
  automatically, so `eas update` simply won't target an incompatible build.

All commands run from `apps/mobile`. You must be logged in once: `eas login`
(check with `eas whoami`).

### Build a new APK (only when native changes, or the first OTA-capable build)

```bash
cd apps/mobile
eas build --platform android --profile indus
```

- Takes ~15–17 min; prints a download URL when done.
- EAS builds from your **local git commit** (no `git push` required for the build).
- This APK embeds the OTA client + whatever JS is current, so distribute it once;
  after that, JS fixes go OTA.

Grab / install the finished APK:

```bash
eas build:list --limit 5            # see recent builds + their URLs/status
eas build:run -p android --latest   # install the latest build to a connected device/emulator
```

### Push a JS-only fix over the air (no rebuild)

```bash
cd apps/mobile
eas update --channel production --message "what you fixed"
```

- Uploads the current JS bundle. SE devices download it silently and apply it on
  the **next app launch** — no reinstall, no store review.
- Channels map to build profiles in `eas.json`: `production` (and `indus`, which
  inherits it), `preview`, `development`.
- **Test first (optional):** build a `preview` APK, install it, then
  `eas update --channel preview --message "test"` and confirm it lands on relaunch.

### Debug a failed EAS build from the terminal (no dashboard needed)

```bash
cd apps/mobile
eas build:list --limit 3                               # find the errored build's ID
eas build:view <BUILD_ID> --json                       # status + error + logFiles URLs
# the logFiles URL is a signed link; it's brotli-compressed NDJSON:
#   curl -s "<logFiles URL>" -o /tmp/log.bin
#   brotli -dc /tmp/log.bin | python3 -c "import json,sys; [print(json.loads(l).get('msg','')) for l in sys.stdin]"
```

---

## Deploy the server-side apps (independent of the mobile APK)

The web dashboard + API reach users through their own deploys — **not** the APK.
Full steps in `DEPLOY_GUIDE.md`.

```bash
# API (Hono on Cloudflare Workers)
pnpm --filter @sri-aparajita/api run deploy

# Web dashboard (Next.js via OpenNext on a Cloudflare Worker)
pnpm --filter @sri-aparajita/web run deploy
```

- Deploys use `wrangler`; authenticate once per machine: `cd apps/api && npx wrangler login`.
- The web deploy auto-copies the maplibre worker chunks as part of its build.

---

## Secrets — how to change them

> Never commit secret **values**. `.env` / `.env.local` are gitignored. Changing a
> Worker secret takes effect on that Worker's **next deploy** — redeploy after
> rotating. `JWT_SECRET` must be identical on the API and Web workers.

### API secrets — Cloudflare Worker `sri-aparajita-api`

```bash
cd apps/api
npx wrangler secret list             # which secrets are set (names only)
npx wrangler secret put <NAME>       # prompts for the value (hidden), sets/rotates it
npx wrangler secret delete <NAME>    # remove one
```

Known API secrets: `DATABASE_URL` (Neon connection string), `JWT_SECRET` (HS256
login signing — must match Web), `NEON_AUTH_COOKIE_SECRET`,
`GOOGLE_GEOCODING_API_KEY` (photo-stamp reverse geocoding), `RESEND_API_KEY`
(email), `VAPID_PRIVATE_KEY` / `VAPID_PUBLIC_KEY` (web push).
Non-secret config (`API_VERSION`, `ENVIRONMENT`, `NEON_JWKS_URL`, `REPORTS_*`, …)
lives as plain `vars` in `apps/api/wrangler.jsonc` — edit there and redeploy.

### Web secrets — Cloudflare Worker `sri-aparajita-web`

```bash
cd apps/web
npx wrangler secret list
npx wrangler secret put <NAME>
```

Known Web secrets: `SRI_APARAJITA_API_BASE_URL` (the API origin) and `JWT_SECRET`
(**same value as the API's**).

### CI/CD secrets — GitHub Actions

GitHub repo → Settings → Secrets and variables → Actions, or via CLI:

```bash
gh secret set <NAME>                  # prompts / reads the value from stdin
gh secret list
```

Used by the workflows: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` (needs
Workers Scripts: Edit + Zone Workers Routes: Edit), `DATABASE_URL`.

### Local development — `.env` files (gitignored, never commit)

- Root **`.env`** — `DATABASE_URL`, `JWT_SECRET` (match the deployed API), and the
  rest of the API env used by local `wrangler dev`.
- **`apps/web/.env.local`** — e.g. `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (Live Tracking
  map), `SRI_APARAJITA_API_BASE_URL` (falls back to localhost:8787 if unset).

### Mobile / EAS build

- Build-time **public** config is in `apps/mobile/eas.json` under each profile's
  `env` (`EXPO_PUBLIC_*`) — these are baked into the app, so **not** for true secrets.
- For a real secret needed at build time, use EAS environment variables:
  ```bash
  cd apps/mobile
  eas env:list --environment production
  eas env:create --environment production --name <NAME> --value <VALUE> --visibility sensitive
  ```

---

## Local development

```bash
pnpm install            # from repo root — installs every workspace
pnpm dev                # runs API (:8787) + Web (:3000) together via Turborepo

# or individually:
pnpm --filter @sri-aparajita/api dev      # API only  (:8787)
pnpm --filter @sri-aparajita/web dev      # Web only  (:3000)
cd apps/mobile && pnpm start              # Expo dev server (mobile)
```

## Checks (run before committing / deploying)

```bash
pnpm --filter @sri-aparajita/api typecheck && pnpm --filter @sri-aparajita/api test
pnpm --filter @sri-aparajita/web typecheck && pnpm --filter @sri-aparajita/web test
cd apps/mobile && pnpm typecheck && pnpm test
pnpm dlx expo-doctor                       # from apps/mobile — SDK/dep health
pnpm check:cycles                          # API import-cycle guard (also a husky pre-commit hook)
```
