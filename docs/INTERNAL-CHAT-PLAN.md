# Internal Chat — Phased Implementation Plan

> **Status:** Planned — **deferred to a future version** (decided 2026-11-28). Captured from a discovery
> discussion the same day. **Phase 0 was spiked and proven on 2026-11-28, then removed** (see §5 Phase 0).
> This doc is the agreed scope + a staged roadmap, not a commitment to ship all of it at once.

## 1. What we're building

A per-enterprise internal messenger inside Distribution OS — "a mini-Slack/WhatsApp for your org" — so office and field staff can talk without leaving the app.

**Decisions captured in discovery (owner-confirmed):**

| Question | Decision |
|----------|----------|
| Purpose | All of: field ↔ office coordination, admin → field announcements, general chit-chat, **and** chat attached to a record (customer/order/invoice) |
| Conversation shapes | **1:1 DMs + one org-wide channel + multiple named channels** |
| Delivery feel | **Fully live** — instant delivery, typing indicators, read receipts |
| Participants | **Everyone in the org** — Super Admin, Manager, Accountant, Sales Executive, Logistics — on **both web and mobile** |
| Who can DM whom | **Anyone can DM anyone** (within their own enterprise) |
| Admin visibility | **Super Admin can read everything** (channels + DMs) for audit/oversight |
| Field offline behaviour | **Must work offline** — queue + send on reconnect, read cached history offline (consistent with the rest of the mobile app) |
| Attachments | Text + emoji + images + PDFs (reuse R2), at minimum |
| Scale (busiest org) | **500+ concurrent users** — realtime topology is a first-class design problem (see §3.2) |
| Retention | **Keep forever** — full message + attachment history retained indefinitely |
| Announcements | A **separate broadcast channel** — only admins/managers post; everyone reads + reacts; replies off/limited |
| Moderation | **Admins (Super Admin / Manager) can delete any message anywhere, including private DMs** |

**Hard constraint that shapes everything:** per-enterprise isolation is non-negotiable. A message must never cross the `enterprise_id` boundary. This rides on the existing Postgres RLS model.

## 2. Reality check (why this is a big build)

This is one of the largest features proposed to date — comparable to several existing modules combined. Two things make it hard on *this* stack specifically:

1. **"Fully live" on Cloudflare Workers needs Durable Objects.** A normal Worker request handler can't hold a connection open. Real-time delivery, presence, and typing indicators require a **Durable Object (DO) per conversation** holding **hibernatable WebSockets**. DOs are *new* to this project (no `durable_objects` binding in `apps/api/wrangler.jsonc` today).
2. **Live chat fights the offline-first field app.** The mobile app is deliberately offline-first (local SQLite, `sync_queue`, delta cursors) because SEs work in poor-signal areas. A WebSocket assumes a stable connection. Reconciling "live when connected" with "queue and catch up when not" is the single hardest part — harder than the chat UI itself.

Neither is a blocker. They're the reason to **phase** the work so something useful ships before the hardest pieces.

> **Build-vs-buy note.** The field already uses WhatsApp (the invoice flow opens the WhatsApp share sheet). In-app chat wins on audit trail, per-record context, and single-app UX — but it is competing with a tool the field already has. Worth re-confirming the value before Phase 3+.

## 3. Architecture

### 3.1 Source of truth vs. live layer

- **Postgres (Neon) is the source of truth.** Every message is persisted to Neon via the existing enterprise-scoped client (`getSqlClient(c)` → `app_tenant` role + `app.enterprise_id`), so RLS auto-scopes by enterprise and no service adds a manual `enterprise_id` filter.
- **Durable Objects are the live fan-out layer only.** One DO instance per conversation (`conversation_id`). It holds the open WebSockets of the members currently connected, broadcasts new messages/typing/read events, and tracks presence. It does **not** own the data — it writes through to Neon (or hands off to the API which writes), so if a DO is cold, history still loads from Postgres.
- **⚠️ 500+ concurrent (busiest org) makes the org-wide channel a hotspot.** One DO holding 500+ sockets for the single org-wide channel, and broadcasting every message/typing event to all of them, is the scaling pinch point. Mitigations to design for from the start: (a) **drop typing indicators and presence on very large channels** (keep them for DMs and small channels); (b) consider **sharded fan-out** (the channel DO delegates to N child DOs each holding a slice of connections); (c) rate-limit broadcasts and coalesce typing events. DMs and small channels stay simple (one DO each). Validate the real fan-out cost in the Phase 0 spike before committing.
- **R2 (`PHOTOS` binding, or a new `CHAT` bucket) for attachments** — keys like `chat/{conversationId}/{messageId}/…`, same pattern as `tasks/`, `invoices/`, `expenditures/`.

```
          ┌─────────── Web (Next.js) ───────────┐     ┌──── Mobile (Expo) ────┐
          │  WebSocket ⇄ live   REST ⇄ history   │     │  WebSocket + SQLite   │
          └───────────────┬─────────────────────┘     └───────────┬───────────┘
                          │                                        │
                   ┌──────▼──────────────── apps/api (Hono on Workers) ─────────┐
                   │  REST: history, send (fallback), channel mgmt, uploads     │
                   │  WS upgrade → routes to the conversation's Durable Object   │
                   └──────┬───────────────────────────────┬─────────────────────┘
                          │ writes-through                │ live broadcast / presence
                   ┌──────▼──────┐                 ┌───────▼────────────┐
                   │ Neon (RLS)  │                 │ Durable Object      │
                   │ chat_*      │                 │  per conversation   │
                   └─────────────┘                 │  (hibernatable WS)  │
                                                   └────────────────────┘
```

### 3.2 Enterprise + auth on every socket

- The WS upgrade request carries the same Neon JWT as REST calls. The API authenticates it, resolves `user_id` + `enterprise_id`, verifies the user is a member of the conversation (or is a Super Admin for audit), **then** routes to the DO. The DO name is namespaced by enterprise (`${enterpriseId}:${conversationId}`) so cross-tenant routing is structurally impossible.
- Every message the DO broadcasts was already authorized at connect time; the DO re-checks membership on send.

### 3.3 Offline-first (mobile) — the hard part

Mirror the app's existing offline machinery rather than inventing a parallel one:

- **Local cache:** new SQLite tables `chat_messages_cache`, `chat_conversations_cache` (like `cached_orders` / `read_cache`).
- **Outbox:** unsent messages go into the existing `sync_queue` (or a dedicated `chat_outbox`) with a `client_uuid`; the server dedupes on `client_uuid` (same idempotency pattern as orders/collections/visits). Send on reconnect, FIFO.
- **Catch-up:** on (re)connect, pull "messages since `last_seen_cursor`" per conversation (delta pull, like ledgers/orders), then open the WebSocket for live tail. `sync_meta` holds the per-conversation cursor.
- **Graceful degrade:** "live" is a best-effort enhancement. Offline, the user still reads cached history and composes messages (queued). Typing indicators / presence simply don't show offline — never block composing on a connection.

### 3.4 Data model (new migration, e.g. `0012_chat.sql`)

All tables follow the tenant RLS pattern from `0001_init.sql`: `enterprise_id uuid NOT NULL DEFAULT public.app_current_enterprise_id()`, `ENABLE ROW LEVEL SECURITY`, `CREATE POLICY enterprise_isolation … USING/WITH CHECK (enterprise_id = public.app_current_enterprise_id())`, plus explicit `GRANT SELECT, INSERT, UPDATE, DELETE … TO app_tenant` (the `0001` grant-on-all doesn't cover later tables).

- **`chat_conversations`** — `id`, `enterprise_id`, `kind` (`dm` | `channel` | `org`), `title` (null for DMs), `created_by`, `created_at`, optional `linked_type`/`linked_id` (for "discuss around a record": `customer`/`order`/`invoice`), `archived_at`.
- **`chat_members`** — `conversation_id`, `user_id`, `role` (`member`/`admin`), `joined_at`, `last_read_message_id` (drives unread counts + read receipts), `muted`. Unique `(conversation_id, user_id)`.
- **`chat_messages`** — `id`, `enterprise_id`, `conversation_id`, `sender_id`, `client_uuid` (idempotent offline send), `body` (text, emoji is just unicode), `created_at`, `edited_at`, `deleted_at` (soft delete for moderation). Index `(conversation_id, created_at desc)`.
- **`chat_attachments`** — `message_id`, `r2_key`, `content_type`, `size_bytes`, `file_name`. Bytes in R2.
- **DM uniqueness:** a deterministic member-pair key so "DM between A and B" resolves to one conversation (e.g. a `dm_key = least(a,b)||':'||greatest(a,b)` unique per enterprise).

### 3.5 API surface (new `apps/api/src/routes/chat.ts`)

- `GET /chat/conversations` — my conversations + unread counts (last message, last_read).
- `POST /chat/conversations` — create/open a DM (resolve-or-create by member pair) or a channel.
- `GET /chat/conversations/:id/messages?before=&limit=` — paged history (also the offline catch-up endpoint via `?since=`).
- `POST /chat/conversations/:id/messages` — send (REST fallback when WS is down; accepts `client_uuid`). Persists, then nudges the DO to broadcast.
- `POST /chat/conversations/:id/read` — advance `last_read_message_id` (read receipts).
- `POST /chat/conversations/:id/attachments` — multipart upload to R2 (≤ 15 MB, same as tasks).
- `GET /chat-files/:attachmentId` — stream an attachment (membership- or Super-Admin-gated).
- `PATCH/DELETE /chat/messages/:id` — edit / soft-delete (author; admin can delete for moderation).
- `GET /chat/ws` — WebSocket upgrade → authenticate → route to the DO.
- Channel admin: `POST /chat/conversations/:id/members`, `DELETE …/members/:userId`, archive.
- **Super Admin audit:** `GET /chat/admin/conversations` + read any thread (read-only), gated to Super Admin.

### 3.6 Clients

- **Web (Next.js):** a `/dashboard/chat` route — conversation list + message pane, using a WebSocket hook for live and TanStack Query for history. Reuses `PageHeader`, dialog, R2 streaming patterns.
- **Mobile (Expo):** a new `(tabs)` entry or an entry from Alerts — offline-first (SQLite cache + outbox), WebSocket for live tail, Expo push for background delivery (reuse `push_tokens` + the existing notification plumbing; extend `se_notifications` or add a `chat` notification type).
- **Shared:** message/types/contracts in `packages/shared`.

### 3.7 Notifications

Background delivery (app closed) rides on the existing **Expo push** infra (`push_tokens`, the notification sender). A new push type `chat_message` → deep-links into the conversation. In-app unread badges come from `last_read_message_id` vs. latest.

## 4. Permissions & visibility

- **Everyone participates** (all five roles), governed through the existing `/permissions` system — add a `chat` section + actions (e.g. `chat.use`, `chat.create_channel`, `chat.moderate`) so an enterprise can still turn it off or limit channel creation.
- **Anyone can DM anyone** in their enterprise (no role gate on DMs, per decision).
- **Super Admin can read all** — unlike the deliberately-private `tasks` feature, chat has an explicit admin audit path. **Admins (Super Admin / Manager) can also delete any message anywhere, including inside private DMs.** ⚠️ Because admins can both **read and delete private DMs**, this **must be disclosed to users** (a one-time notice / policy line at first use) so it isn't a surprise — important for trust and possibly compliance. Treat this disclosure as a required part of Phase 5, not optional.
- Soft-delete + edit history retained for audit (**messages are kept forever** — a deleted message is hidden from the UI but preserved for the audit trail; purge only ever happens via an explicit, separate admin/legal action, never automatically).

## 5. Phased roadmap

Each phase is independently shippable and leaves the app in a working state.

### Phase 0 — Spike & decisions (before any feature code) — ✅ DONE (2026-11-28, then removed)

**Proven** with a throwaway spike (`ChatRoomSpike` DO + `/chat-spike` routes, since deleted — recreate from this section):
- ✅ Durable Objects + **hibernatable WebSockets** (`state.acceptWebSocket`) work on the current `distribution-os-api` Worker. **No new compat flags** — `compatibility_date: 2026-07-03` already supports WS hibernation. Binding = `durable_objects.bindings[{ name: "CHAT_ROOM", class_name: "ChatRoomSpike" }]` + `migrations: [{ tag, new_sqlite_classes: ["ChatRoomSpike"] }]`. `wrangler deploy --dry-run` accepted it.
- ✅ **Enterprise isolation is structural** via `CHAT_ROOM.idFromName(\`${enterpriseId}:${conversationId}\`)` — a 3-client test confirmed a client in enterprise B with the *same* room name lands in a **different DO instance** and sees zero enterprise-A traffic (and vice versa).
- ✅ **Auth handshake**: Neon JWT (header or `?token=`) → `verifyNeonToken` → `users.app_login_id` → `{userId, enterpriseId}`, passed to the DO as **server-trusted headers** (never from the client). Broadcast + presence (join/leave) verified.

**Gotchas to carry into Phase 3:**
- ⚠️ **tsconfig:** `apps/api` uses the `WebWorker` lib, *not* global `@cloudflare/workers-types`. A global `/// <reference types="@cloudflare/workers-types" />` pollutes `Response.json()` → `unknown` across the whole package (breaks ~every test file). Use **type-only imports + module-scoped `declare`** for Cloudflare-only globals (`WebSocketPair`, `webSocket` ResponseInit) instead.
- Browsers can't set headers on a WS upgrade → pass the token via `?token=` (or `Sec-WebSocket-Protocol`), not `Authorization`.

**Still to decide before Phase 1:** attachment bucket (reuse `PHOTOS` vs. new `CHAT`), and validate fan-out at the 500+ scale (the spike used 3 clients — see §3.2 / §6).

### Phase 1 — MVP: persistent messaging, not yet "live"
- Migration `0012_chat.sql` (tables + RLS + grants).
- REST send/history, DM resolve-or-create, org-wide channel auto-provisioned per enterprise, plus a **read-only "Announcements" broadcast channel** (only admins/managers post; everyone reads + reacts; replies off/limited) provisioned per enterprise.
- Web `/dashboard/chat` + mobile screen, **polling or push-refresh** (no WebSocket yet).
- Text + emoji only. Unread counts via `last_read`.
- Expo push for new messages.
- **Value shipped:** everyone can message everyone, history persists, works across web+mobile. Feels like email-grade chat.

### Phase 2 — Offline-first on mobile
- SQLite cache + outbox (`client_uuid` idempotency), delta catch-up via `?since=` cursor, send-on-reconnect through `sync_queue`.
- **Value shipped:** field staff use chat in poor signal exactly like the rest of the app.

### Phase 3 — Go live (Durable Objects)
- DO per conversation, WebSocket tail, instant delivery, presence.
- Typing indicators + read receipts.
- Graceful degrade to Phase-1/2 behaviour when WS unavailable.
- **Value shipped:** the "fully live" experience.

### Phase 4 — Attachments & record-linking
- Image + PDF upload to R2, inline preview (reuse invoice/task viewers).
- "Discuss around a record" — start/attach a conversation from a customer/order/invoice (`linked_type`/`linked_id`), with a chat entry point on those detail screens.

### Phase 5 — Admin, moderation, polish
- Super Admin audit view (read-only, all conversations).
- Channel management (create/rename/archive, add/remove members), message edit/delete, mute, `/permissions` wiring.
- User-facing "admins can read messages" disclosure.

## 6. Risks & open questions

**Resolved in discovery** (now in the §1 decisions table): scale (500+ concurrent → §3.2 hotspot design), retention (keep forever), announcements (separate broadcast channel), moderation (admins delete anything, anywhere incl. DMs).

**Still open — resolve before/within Phase 0:**

1. **Durable Objects cost/ops** — new billable primitive; confirm pricing at your org counts (500+ concurrent) and that ops (deploy, logging, the `/wrangler` flow) are understood.
2. **WebSockets through the custom domain + workers.dev** — the mobile app hits the workers.dev URL; confirm WS upgrades work there and through any proxy.
3. **Fan-out at 500+** — validate in the Phase 0 spike whether one DO per channel survives 500+ sockets, or whether sharded fan-out / dropping presence on large channels is needed from day one (see §3.2).
4. **"Keep forever" storage growth** — messages + R2 attachments accumulate indefinitely; confirm the storage/cost trajectory is acceptable and plan R2 lifecycle/billing accordingly (no auto-purge, but monitor growth).
5. **Private-DM admin access disclosure** — admins can read *and* delete private DMs; the first-use disclosure (§4) is a hard requirement, not a nicety. Confirm wording with whoever owns policy/compliance.
6. **Push noise** — a chatty 500-person org could spam field phones; need per-conversation mute + sensible batching from day one.

## 7. Rough effort (order-of-magnitude, not a quote)

- Phase 0: small spike.
- Phase 1 (MVP, non-live): the bulk of a normal feature — migration + API + two clients.
- Phase 2 (offline): moderate — leverages existing sync patterns.
- Phase 3 (live/DO): the largest and riskiest single phase — new infra.
- Phases 4–5: incremental.

Recommendation: **ship Phase 1 + 2 first and live with it** before committing to Phase 3. A persistent, offline-capable, push-notified messenger may already cover 80% of the need; "fully live" is a real step-up in cost and risk that's easier to justify once people are actually using chat.
