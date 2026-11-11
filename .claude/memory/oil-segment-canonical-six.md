---
name: oil-segment-canonical-six
description: Oil segments are a canonical SIX; catalogue re-seeds reintroduce old vocab and break product edit/targets
metadata:
  node_type: memory
  type: project
  originSessionId: 0b4435cc-5363-4ff4-b2d0-7af21abc73b5
  modified: 2026-10-04T18:28:24.343Z
---

The app's oil segments were the **canonical six**: `Car`, `2W`, `3W`, `Commercial`, `Agri`, `Gear Oil`. **Update 2026-10-09: `Coolant` and `Grease` were added as two more segments** (product-type segments like Gear Oil, for the Savsol catalogue) — so the live set is now **eight**. They were added to all nine segment enumerations (see [[savsol-dual-brand-and-segments]]). The lists are still hardcoded as `OIL_SEGMENTS` (apps/api targets/dashboard-analytics), `ALLOWED_SEGMENTS` (apps/api products), `PRODUCT_SEGMENTS` (apps/web product form), etc. — when adding a segment, update ALL of them or roll-ups silently drop it. The OLD vocabulary was `Cars`, `Tractors`, `Industrial` (plus others); mapping to canonical is **Cars→Car, Tractors→Agri, Industrial→Commercial**.

**Recurring gotcha (hit 2026-10-04):** the catalogue seed/re-seed script still writes the OLD vocab. Migration `0081` normalized it once, but a later catalogue RE-SEED reintroduced the old names. Symptom: editing a product throws **"Invalid segment: Cars"**, orders can't be placed on those products, and per-segment performance/targets/analytics don't aggregate. Fix = re-run the normalize UPDATEs on `product_segments` + `order_items` (idempotent). Migration `0092_renormalize_oil_segments.sql` is the canonical fix and mirrors `0081`.

**Why:** code validates against the canonical six; any product carrying an old segment name is rejected on write and silently missed on roll-ups.

**How to apply:** if "Invalid segment" reappears or segment numbers look empty, check `product_segments`/`order_items` for old vocab and re-normalize (copy the 0092 pattern into a new migration). Also fix the seed script if it's still emitting old names. AGENTS.md now documents the canonical six.
