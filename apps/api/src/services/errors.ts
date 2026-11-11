/**
 * In-house error monitoring (2026-08-23). Errors from the API, web, and mobile
 * are deduplicated into `error_groups` by a fingerprint; each occurrence is an
 * `error_event`. SUPER_ADMIN triages a group (status + assignee + notes) on the
 * web /errors page. Replaces a third-party monitor like Sentry.
 *
 * `captureError` writes group + event in ONE atomic statement (a CTE), so it
 * costs a single Workers subrequest and can be fired from the error handler via
 * `waitUntil` without blocking or destabilising the response.
 */
import type { SqlClient } from "../lib/db";

export type ErrorSource = "api" | "web" | "mobile";
export type ErrorLevel = "error" | "fatal" | "warning";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CaptureInput {
  source: ErrorSource;
  message: string;
  stack?: string | null;
  /** Error class or code — TypeError, an ApiError code, a mobile error name. */
  kind?: string | null;
  level?: ErrorLevel;
  route?: string | null;
  method?: string | null;
  statusCode?: number | null;
  requestId?: string | null;
  userId?: string | null;
  role?: string | null;
  /** The enterprise whose request produced this error. NULL for platform/unauth
   *  errors (login, public, webhook, cron) — owner-only, never shown to a tenant. */
  enterpriseId?: string | null;
  environment?: string | null;
  appVersion?: string | null;
  context?: unknown;
}

/** FNV-1a → 8-char hex. Cheap, synchronous, stable — good enough to group. */
function hash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Strip the variable parts of a message so "User 4f2c… not found" and
 * "User 91ab… not found" collapse to one group: lowercase, blank out UUIDs,
 * long hex, numbers, and quoted strings, then collapse whitespace.
 */
function normalizeMessage(message: string): string {
  return message
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<uuid>")
    .replace(/0x[0-9a-f]+/g, "<hex>")
    .replace(/["'`][^"'`]*["'`]/g, "<str>")
    .replace(/\b\d+\b/g, "<n>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

/** First meaningful stack frame, so the same throw site groups together. */
function topFrame(stack: string | null | undefined): string {
  if (!stack) return "";
  const line = stack
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("at ") || l.includes("@"));
  return (line ?? "").replace(/:\d+:\d+/g, "").slice(0, 200);
}

export function fingerprintOf(input: CaptureInput): string {
  const basis = [
    input.source,
    input.kind ?? "",
    normalizeMessage(input.message),
    topFrame(input.stack),
  ].join("|");
  return hash(basis);
}

function asUuid(value: string | null | undefined): string | null {
  return value && UUID_RE.test(value) ? value : null;
}

const MAX_CONTEXT_BYTES = 8000;

/**
 * Serialize the free-form context to jsonb text, but never let a client bloat
 * the table: anything over ~8KB is dropped for a small marker. Any value that
 * can't be stringified (cycles, BigInt) becomes null rather than throwing.
 */
function serializeContext(context: unknown): string | null {
  if (context == null) return null;
  try {
    const json = JSON.stringify(context);
    if (json.length > MAX_CONTEXT_BYTES) {
      return JSON.stringify({ _truncated: true, bytes: json.length });
    }
    return json;
  } catch {
    return null;
  }
}

/**
 * Record one error occurrence. New fingerprint → a new open group; a repeat →
 * bump count + last_seen. A repeat of a RESOLVED group reopens it (a regression
 * you'll want to see); an IGNORED group stays muted. One round-trip, atomic.
 * Returns the group id and whether the group was newly created.
 */
export async function captureError(
  sql: SqlClient,
  input: CaptureInput,
): Promise<{ groupId: string; isNew: boolean }> {
  const fingerprint = fingerprintOf(input);
  const title = input.message.replace(/\s+/g, " ").trim().slice(0, 300) || "(no message)";
  const contextJson = serializeContext(input.context);

  const rows = await sql`
    /* capture_error */
    with g as (
      insert into error_groups
        (enterprise_id, fingerprint, source, title, kind, level, sample_stack, sample_route,
         occurrence_count, first_seen_at, last_seen_at)
      values
        (${asUuid(input.enterpriseId)}::uuid, ${fingerprint}, ${input.source}, ${title}, ${input.kind ?? null},
         ${input.level ?? "error"}, ${input.stack ?? null}, ${input.route ?? null},
         1, now(), now())
      on conflict (enterprise_id, fingerprint) do update set
        occurrence_count = error_groups.occurrence_count + 1,
        last_seen_at = now(),
        updated_at = now(),
        sample_stack = coalesce(excluded.sample_stack, error_groups.sample_stack),
        sample_route = coalesce(excluded.sample_route, error_groups.sample_route),
        status = case when error_groups.status = 'resolved' then 'open' else error_groups.status end,
        resolved_at = case when error_groups.status = 'resolved' then null else error_groups.resolved_at end,
        resolved_by = case when error_groups.status = 'resolved' then null else error_groups.resolved_by end
      returning id, (xmax = 0) as is_new
    ),
    e as (
      insert into error_events
        (group_id, enterprise_id, source, message, stack, route, method, status_code, request_id,
         user_id, role, environment, app_version, context)
      select
        g.id, ${asUuid(input.enterpriseId)}::uuid, ${input.source}, ${input.message}, ${input.stack ?? null}, ${input.route ?? null},
        ${input.method ?? null}, ${input.statusCode ?? null}, ${input.requestId ?? null},
        ${asUuid(input.userId)}::uuid, ${input.role ?? null}, ${input.environment ?? "production"},
        ${input.appVersion ?? null}, ${contextJson}::jsonb
      from g
      returning group_id
    )
    select g.id, g.is_new from g`;

  const row = rows[0] as { id: string; is_new: boolean } | undefined;
  return { groupId: row?.id ?? "", isNew: Boolean(row?.is_new) };
}

// ---- Triage read/write (SUPER_ADMIN web viewer) --------------------------

export interface ListFilters {
  status?: string | null;
  source?: string | null;
  level?: string | null;
  page?: number;
  pageSize?: number;
}

export async function errorSummary(sql: SqlClient) {
  const [rows, latest] = await Promise.all([
    sql`select status, count(*)::int as n, coalesce(sum(occurrence_count),0)::int as events
        from error_groups group by status`,
    sql`select coalesce(max(last_seen_at), null) as last_seen from error_groups where status = 'open'`,
  ]);
  const byStatus: Record<string, { groups: number; events: number }> = {};
  for (const r of rows as { status: string; n: number; events: number }[]) {
    byStatus[r.status] = { groups: r.n, events: r.events };
  }
  return {
    open: byStatus.open ?? { groups: 0, events: 0 },
    resolved: byStatus.resolved ?? { groups: 0, events: 0 },
    ignored: byStatus.ignored ?? { groups: 0, events: 0 },
    lastSeen: (latest[0] as { last_seen: string | null } | undefined)?.last_seen ?? null,
  };
}

export async function listErrorGroups(sql: SqlClient, filters: ListFilters) {
  const status = filters.status && filters.status !== "all" ? filters.status : null;
  const source = filters.source && filters.source !== "all" ? filters.source : null;
  const level = filters.level && filters.level !== "all" ? filters.level : null;
  const pageSize = Math.min(Math.max(filters.pageSize ?? 50, 1), 100);
  const page = Math.max(filters.page ?? 1, 1);
  const offset = (page - 1) * pageSize;

  const groups = await sql`
    /* list_error_groups */
    select
      g.id, g.fingerprint, g.source, g.title, g.kind, g.level, g.status,
      g.occurrence_count as "occurrenceCount",
      g.first_seen_at as "firstSeenAt", g.last_seen_at as "lastSeenAt",
      g.sample_route as "sampleRoute",
      g.assigned_to as "assignedTo", u.name as "assignedToName"
    from error_groups g
    left join users u on u.id = g.assigned_to
    where (${status}::text is null or g.status = ${status})
      and (${source}::text is null or g.source = ${source})
      and (${level}::text is null or g.level = ${level})
    order by g.last_seen_at desc
    limit ${pageSize} offset ${offset}`;

  const [{ total }] = (await sql`
    select count(*)::int as total from error_groups g
    where (${status}::text is null or g.status = ${status})
      and (${source}::text is null or g.source = ${source})
      and (${level}::text is null or g.level = ${level})`) as { total: number }[];

  return { groups, page, pageSize, total };
}

export async function getErrorGroupDetail(sql: SqlClient, id: string) {
  const [group] = await sql`
    /* error_group_detail */
    select
      g.id, g.fingerprint, g.source, g.title, g.kind, g.level, g.status,
      g.occurrence_count as "occurrenceCount",
      g.first_seen_at as "firstSeenAt", g.last_seen_at as "lastSeenAt",
      g.sample_stack as "sampleStack", g.sample_route as "sampleRoute",
      g.assigned_to as "assignedTo", u.name as "assignedToName",
      g.resolved_by as "resolvedBy", r.name as "resolvedByName", g.resolved_at as "resolvedAt"
    from error_groups g
    left join users u on u.id = g.assigned_to
    left join users r on r.id = g.resolved_by
    where g.id = ${id}::uuid`;
  if (!group) return null;

  const [events, notes] = await Promise.all([
    sql`/* error_group_events */
        select id, message, stack, route, method,
               status_code as "statusCode", request_id as "requestId",
               user_id as "userId", role, environment,
               app_version as "appVersion", context, created_at as "createdAt"
        from error_events where group_id = ${id}::uuid
        order by created_at desc limit 20`,
    sql`/* error_group_notes */
        select n.id, n.body, n.created_at as "createdAt", u.name as "authorName"
        from error_notes n left join users u on u.id = n.author_id
        where n.group_id = ${id}::uuid order by n.created_at asc`,
  ]);

  return { group, events, notes };
}

/** Update status and/or assignee. Resolving stamps resolver + time. */
export async function updateErrorGroup(
  sql: SqlClient,
  id: string,
  actorUserId: string,
  patch: { status?: string | null; assignedTo?: string | null },
) {
  const status = patch.status ?? null;
  const assignedTo = patch.assignedTo === undefined ? undefined : asUuid(patch.assignedTo);

  const [row] = await sql`
    /* update_error_group */
    update error_groups set
      status = coalesce(${status}, status),
      assigned_to = case when ${assignedTo === undefined} then assigned_to else ${assignedTo ?? null}::uuid end,
      resolved_at = case when ${status} = 'resolved' then now()
                         when ${status} in ('open','ignored') then null
                         else resolved_at end,
      resolved_by = case when ${status} = 'resolved' then ${asUuid(actorUserId)}::uuid
                         when ${status} in ('open','ignored') then null
                         else resolved_by end,
      updated_at = now()
    where id = ${id}::uuid
    returning id`;
  return Boolean(row);
}

export async function addErrorNote(
  sql: SqlClient,
  id: string,
  authorId: string,
  body: string,
) {
  const [note] = await sql`
    /* add_error_note */
    insert into error_notes (group_id, author_id, body)
    values (${id}::uuid, ${authorId}::uuid, ${body})
    returning id, body, created_at as "createdAt"`;
  return note;
}

/**
 * Retention: delete error_events older than 90 days, and empty resolved groups
 * whose last occurrence is long past. Self-gated to ~once/day via system_settings
 * so it rides the existing 3-minute maintenance cron cheaply.
 */
export async function cleanupOldErrors(sql: SqlClient): Promise<{ ran: boolean }> {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const [gate] = await sql`
    insert into system_flags (key, value)
    values ('errors_last_prune_date', ${today})
    on conflict (key) do update set value = excluded.value, updated_at = now()
    where system_flags.value is distinct from excluded.value
    returning key`;
  if (!gate) return { ran: false };

  await sql`delete from error_events where created_at < now() - interval '90 days'`;
  await sql`delete from error_groups
            where status in ('resolved','ignored')
              and last_seen_at < now() - interval '90 days'`;
  return { ran: true };
}
