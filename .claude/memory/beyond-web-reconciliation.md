---
name: beyond-web-reconciliation
description: Sri Aparajita's WEB app is being reconciled feature-by-feature from the Beyond codebase (Beyond = source of truth for newer/correct web logic+UI+bugfixes); user drives one component at a time, never a bulk port
metadata:
  type: project
---

**Ongoing effort (started 2026-10-16):** bring the Beyond web app's UI/UX, new features, and already-fixed bugs into Sri Aparajita's web. The mobile "distribution master" work (Beyond mobile → SA) is mostly done; now it's the web's turn.

**How to approach it (the user's explicit rules):**
- **Beyond is at `~/Desktop/Beyond-Distribution-Management-System`** (Sri Aparajita at `~/Desktop/Sri-Aparajita-Distribution-OS`; Sree Balaji is a third fork). **No shared git history** — it's a clean-copy/rebranded fork (0 common commits; Beyond had ~483 commits vs SA ~207), so reconcile by **content diff**, not git.
- **Do NOT bulk-reconcile.** The user said "I will tell you, dont reconcile" — he drives it **one component/feature at a time** and answers scoping questions first. Always ask (don't assume) before porting: which surface, replace-vs-add, keep-vs-change.
- **Dashboard-area dues/cards files are identically named** in both repos and differ **only in logic/UI (no branding/region strings)** — so a verified diff of a dues/dashboard file is a clean port target; copy Beyond's version and re-check for SA-specific divergence.
- Beyond's web generally has the newer, "correct" logic; SA often has the older version. But confirm direction per feature — SA also has client-specific additions Beyond lacks (billing/Razorpay, customer statement, Neon Auth BFF routes, Telangana map).

**Features Beyond has that SA's web lacks** (candidates, from the 2026-10-16 inventory, NOT yet ported): WhatsApp integration (`features/whatsapp`, `whatsapp.ts` API, ~3k LOC), Stock/inventory journal (`features/stock`, `stock.ts`), in-app **invoice GENERATION + PDF** (`features/invoicing`, `invoicing*.ts` ×4 — SA only *uploads* invoices via the parser), Reports charts overhaul, attendance redesign, settings redesign, dashboard `metrics-reconciliation`.

**Done so far this session (2026-10-15→16), committed to SA main (NOT pushed unless noted):**
- **Dashboard stat cards reworked:** per-brand oil cards (one tile per oil brand with orders, dynamic/biggest-first, ordered litres net of returns from `order_items→products.brand`; new `metrics.oilsByBrand` + `/dashboard/analytics/oils-by-brand`); **Visits + Productive-visits cards MERGED** into the single colour-graded **Productivity** card (Beyond's presentation; formula `productive÷visits` was already identical); **Bearings card REMOVED** and the dead `metrics.bearings` field + `metrics_bearings` query dropped. Kept "Total Ordered Oils" + delivered "Sold Oil" as the aggregate cards.
- **"Outcomes & follow-ups" dashboard component REMOVED entirely** — deleted `features/dashboard/followups/` + `GET /followups/feed` + the feed service code (`listVisitOutcomes`, `OutcomeFeedRow`, `mapOutcome`). The **mobile follow-up system is untouched** (`GET/POST /followups/customers/:id[/resolve]`, `getLatestOpenFollowup`/`resolveLatestOpenForCustomer`/`createCheckoutFollowup`/`runFollowupReminders`).
- **Customer dues → invoice-level ageing** — see [[dashboard-dues-invoice-ageing]].

**Note:** the web app on localhost calls the **deployed** Cloudflare Worker API, so API-side changes (new fields/endpoints) aren't visible in the browser until `apps/api` is deployed. See [[local-dev-uses-live-prod]].
