import type { SqlClient } from "../lib/db";
import type { Role } from "../types";

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  return 0;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** The freshest item of a type, to name it in the desktop notification. Each
 *  carries the acting executive's first name for a context-aware body ("Sandeep ·
 *  Ravi Motors"); null when the item wasn't created by a sales executive. */
export interface LatestCollection {
  amount: number;
  customer: string;
  executive: string | null;
}
export interface LatestOrder {
  value: number;
  customer: string;
  executive: string | null;
}
export interface LatestVisit {
  customer: string;
  executive: string | null;
}
type LatestRow = { amount?: unknown; value?: unknown; customer?: unknown; executive?: unknown } | null;

const OFFICE_ROLES: Role[] = ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"];

/**
 * Sidebar notification counts for the current user.
 *
 * - `tasksActive`: tasks the user created or is assigned to that are still
 *   open or in progress (mirrors the Tasks page "N active" badge; tasks are
 *   private to creator + assignee).
 * - `alertsOpen`: open alerts — a SUPER_ADMIN / MANAGER surface only (no Alerts
 *   nav for other roles), so it stays 0 for everyone else.
 * - `ordersNew` / `collectionsNew`: items created since the office user last
 *   opened that page (section_seen.last_seen_at). Clears when they open it.
 *   Office roles only; 0 for SEs (they don't use the web sidebar).
 * - `visitsNew`: field check-ins so far TODAY (IST). Unlike orders/collections it
 *   has no "seen" page to clear against — it exists only to drive the audio alert,
 *   which fires on each increase between polls (a fresh check-in). Office roles only.
 */
export async function getBadgeCounts(
  sql: SqlClient,
  ctx: { userId: string; role: Role | null },
): Promise<{
  tasksActive: number;
  alertsOpen: number;
  ordersNew: number;
  collectionsNew: number;
  visitsNew: number;
  latestCollection: LatestCollection | null;
  latestOrder: LatestOrder | null;
  latestVisit: LatestVisit | null;
}> {
  // One round-trip: every badge in a single SELECT of scalar subqueries. The
  // office-only parts are CASE-gated on the role flags, so CASE short-circuits
  // them for SEs (their subqueries never run) — same gating as before, minus the
  // 3 extra Neon round-trips this endpoint used to make on every 60s poll.
  const isOffice = ctx.role != null && OFFICE_ROLES.includes(ctx.role);
  const isAlertsRole = ctx.role === "SUPER_ADMIN" || ctx.role === "MANAGER";
  const todayIst = sql`(date_trunc('day', now() at time zone 'Asia/Kolkata')) at time zone 'Asia/Kolkata'`;

  const [row] = await sql`
    /* badge_counts */
    select
      (select count(*)::int from tasks
         where (created_by = ${ctx.userId}::uuid or assigned_to = ${ctx.userId}::uuid)
           and status in ('open', 'in_progress')) as "tasksActive",
      case when ${isOffice} then (select count(*)::int from orders o
         where o.created_at > coalesce(
           (select last_seen_at from section_seen where user_id = ${ctx.userId}::uuid and section = 'orders'),
           now())) else 0 end as "ordersNew",
      case when ${isOffice} then (select count(*)::int from collections c
         where c.created_at > coalesce(
           (select last_seen_at from section_seen where user_id = ${ctx.userId}::uuid and section = 'collections'),
           now())) else 0 end as "collectionsNew",
      case when ${isOffice} then (select count(*)::int from visits v
         where v.check_in_time >= ${todayIst}) else 0 end as "visitsNew",
      case when ${isOffice} then (select json_build_object('amount', c.collection_amount, 'customer', cust.legal_name,
                                   'executive', split_part(u.name, ' ', 1))
         from collections c join customers cust on cust.id = c.customer_id
         left join users u on u.id = c.collected_by_user_id
         order by c.created_at desc limit 1) else null end as "collection",
      case when ${isOffice} then (select json_build_object('value', o.total_invoice_value, 'customer', cust.legal_name,
                                   'executive', split_part(u.name, ' ', 1))
         from orders o join customers cust on cust.id = o.customer_id
         left join users u on u.id = o.sales_executive_id
         order by o.created_at desc limit 1) else null end as "order",
      case when ${isOffice} then (select json_build_object('customer', cust.legal_name,
                                   'executive', split_part(u.name, ' ', 1))
         from visits v join customers cust on cust.id = v.customer_id
         left join users u on u.id = v.executive_id
         where v.check_in_time >= ${todayIst}
         order by v.check_in_time desc limit 1) else null end as "visit",
      case when ${isAlertsRole} then (select count(*)::int from alerts where status = 'open') else 0 end as "alertsOpen"
  `;

  const coll = (row?.collection ?? null) as LatestRow;
  const ord = (row?.order ?? null) as LatestRow;
  const vis = (row?.visit ?? null) as LatestRow;

  return {
    tasksActive: num(row?.tasksActive),
    alertsOpen: num(row?.alertsOpen),
    ordersNew: num(row?.ordersNew),
    collectionsNew: num(row?.collectionsNew),
    visitsNew: num(row?.visitsNew),
    latestCollection: coll
      ? { amount: num(coll.amount), customer: str(coll.customer), executive: str(coll.executive) || null }
      : null,
    latestOrder: ord
      ? { value: num(ord.value), customer: str(ord.customer), executive: str(ord.executive) || null }
      : null,
    latestVisit: vis ? { customer: str(vis.customer), executive: str(vis.executive) || null } : null,
  };
}
