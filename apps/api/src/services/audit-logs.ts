import type { SqlClient } from "../lib/db";
import { resolvePage, resolveSort } from "../lib/pagination";

type Row = Record<string, unknown>;

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  return "";
}

function nullStr(v: unknown): string | null {
  const s = str(v);
  return s.length > 0 ? s : null;
}

function mapAuditRow(row: Row) {
  return {
    id: str(row.id),
    createdAt: str(row.createdAt),
    actorUserId: nullStr(row.actorUserId),
    actorName: str(row.actorName),
    actorRole: nullStr(row.actorRole),
    action: str(row.action),
    entityType: nullStr(row.entityType),
    entityId: nullStr(row.entityId),
    entityLabel: nullStr(row.entityLabel),
    summary: str(row.summary),
    metadata: row.metadata ?? null,
  };
}

export interface PagedAuditLogsParams {
  q?: string | null;
  actorId?: string | null;
  entityType?: string | null;
  action?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  sort?: string | null;
  dir?: string | null;
  page?: number | null;
  pageSize?: number | null;
}

const AUDIT_COLUMNS = `
  a.id,
  a.created_at as "createdAt",
  a.actor_user_id as "actorUserId",
  a.actor_name as "actorName",
  a.actor_role as "actorRole",
  a.action,
  a.entity_type as "entityType",
  a.entity_id as "entityId",
  a.entity_label as "entityLabel",
  a.summary,
  a.metadata`;

const AUDIT_SORTS: Record<string, string> = {
  createdAt: "a.created_at",
  actorName: "a.actor_name",
  action: "a.action",
  entityType: "a.entity_type",
};

/** Server-side filtered/sorted/paginated audit log for the SUPER_ADMIN page. */
export async function listAuditLogsPaged(sql: SqlClient, opts: PagedAuditLogsParams) {
  const conds: string[] = [];
  const params: unknown[] = [];
  const add = (cond: (p: string) => string, value: unknown) => {
    params.push(value);
    conds.push(cond(`$${params.length}`));
  };

  const actorId = (opts.actorId ?? "").trim();
  if (actorId) add((p) => `a.actor_user_id = ${p}::uuid`, actorId);
  const entityType = (opts.entityType ?? "").trim();
  if (entityType) add((p) => `a.entity_type = ${p}`, entityType);
  const action = (opts.action ?? "").trim();
  if (action) add((p) => `a.action = ${p}`, action);
  const fromDate = (opts.fromDate ?? "").trim();
  if (fromDate) add((p) => `a.created_at >= ${p}::date`, fromDate);
  const toDate = (opts.toDate ?? "").trim();
  if (toDate) add((p) => `a.created_at < (${p}::date + interval '1 day')`, toDate);
  const q = (opts.q ?? "").trim();
  if (q) {
    params.push(`%${q}%`);
    const p = `$${params.length}`;
    conds.push(`(a.summary ilike ${p} or a.entity_label ilike ${p} or a.actor_name ilike ${p})`);
  }
  const whereSql = conds.length ? `where ${conds.join(" and ")}` : "";

  const sort = resolveSort(opts.sort, opts.dir, AUDIT_SORTS, "createdAt");
  const { limit, offset, page, pageSize } = resolvePage(opts.page, opts.pageSize);

  // Count and page are independent — one parallel batch, not two sequential
  // ~50ms round-trips.
  const [countResult, rowsResult] = await Promise.all([
    sql.query(
      `/* list_audit_logs_paged_count */ select count(*)::int as total from audit_logs a ${whereSql}`,
      params,
    ),
    sql.query(
      `/* list_audit_logs_paged */
     select ${AUDIT_COLUMNS} from audit_logs a
     ${whereSql}
     order by ${sort.expr} ${sort.dir} nulls last, a.created_at desc
     limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, limit, offset],
    ),
  ]);
  const [countRow] = countResult as Row[];
  const rows = rowsResult as Row[];

  return {
    rows: rows.map(mapAuditRow),
    total: Number(countRow?.total ?? 0),
    page,
    pageSize,
  };
}

/** Distinct actors / entity types / actions present in the log — for the filters. */
export async function auditLogFilterOptions(sql: SqlClient) {
  const actors = (await sql`
    /* audit_filter_actors */
    select actor_user_id as "id", max(actor_name) as "name"
    from audit_logs
    where actor_user_id is not null
    group by actor_user_id
    order by max(actor_name)
  `) as Row[];
  const entityTypes = (await sql`
    /* audit_filter_entity_types */
    select distinct entity_type as "value" from audit_logs
    where entity_type is not null order by entity_type
  `) as Row[];
  const actions = (await sql`
    /* audit_filter_actions */
    select distinct action as "value" from audit_logs order by action
  `) as Row[];

  return {
    actors: actors.map((r) => ({ id: str(r.id), name: str(r.name) })),
    entityTypes: entityTypes.map((r) => str(r.value)).filter(Boolean),
    actions: actions.map((r) => str(r.value)).filter(Boolean),
  };
}
