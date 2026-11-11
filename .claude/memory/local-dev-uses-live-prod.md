---
name: local-dev-uses-live-prod
description: Local dev (wrangler dev + Next dev) loads root .env with LIVE Razorpay keys and the PROD Neon DB — local billing/DB actions hit production
metadata:
  node_type: memory
  type: project
  originSessionId: 40c06ed0-aa9f-4d4f-85b7-707c59c2b768
  modified: 2026-09-30T09:07:53.205Z
---

`apps/api` dev runs `wrangler dev --env-file ../../.env`, and that root `.env`
holds `RAZORPAY_KEY_ID=rzp_live_***` (LIVE Razorpay account) and a production
Neon `DATABASE_URL` (host `ep-proud-forest-…neon.tech`). There is no `.dev.vars`
and no separate test/sandbox config.

**So "testing locally" is NOT isolated** — any billing mutation (subscribe,
pause, resume, cancel) from localhost calls the real live Razorpay account and
the production DB, on the client's real subscription. Deploying to prod does not
change billing behaviour vs local for these calls; it's the same account + DB.

**Why:** single-client deployment; no sandbox was set up.
**How to apply:** Before running any billing/DB write from local, treat it as a
production action — get explicit consent, prefer reversible/no-charge flows, and
never assume a localhost billing call is a safe sandbox. See [[razorpay-pause-resume-feature-gate]].
