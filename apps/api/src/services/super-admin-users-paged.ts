import { buildSearchConds, resolvePage, resolveSort } from "../lib/pagination";
import type { SqlClient } from "../lib/db";
import type { Role } from "../types";

type Row = Record<string, unknown>;

/** Whitelisted, inlinable sort expressions (client values never reach SQL raw). */
const USER_SORTS: Record<string, string> = {
  name: "u.name",
  status: "u.status",
  createdAt: "u.created_at",
};

const ROLE_CODES = new Set<Role>([
  "SUPER_ADMIN",
  "MANAGER",
  "ACCOUNTANT",
  "SALES_EXECUTIVE",
  "LOGISTICS",
]);

// Normalized search blob — lowercases and strips non-alphanumerics to mirror
// searchTokens(), so "98765", "jo.hn" and "John Doe" all match sensibly across
// name/email/phone. A trusted expression (built here, never from client input).
const SEARCH_BLOB =
  "regexp_replace(lower(u.name || ' ' || coalesce(u.email,'') || ' ' || coalesce(u.phone,'')), '[^a-z0-9]', '', 'g')";

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nstr(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function num(value: unknown): number {
  return typeof value === "number" ? value : Number(value) || 0;
}

function parseRoles(value: unknown): Role[] {
  if (typeof value !== "string" || value.length === 0) return [];
  return value
    .split(",")
    .map((r) => r.trim())
    .filter((r): r is Role => ROLE_CODES.has(r as Role));
}

export interface UsersPagedOptions {
  search?: string | null;
  role?: string | null;
  status?: string | null;
  sort?: string | null;
  dir?: string | null;
  page?: number | null;
  pageSize?: number | null;
}

/**
 * Server-paged user list for the Users page (SUPER_ADMIN). Tenant isolation is
 * handled by RLS on the scoped client — no manual enterprise_id filter, matching
 * every other service. Search + role + status filter server-side; sort/paging are
 * whitelisted and clamped. Returns `{ users, total, page, pageSize }`.
 */
export async function listSuperAdminUsersPaged(
  sql: SqlClient,
  opts: UsersPagedOptions,
) {
  const params: unknown[] = [];
  const conds: string[] = [];

  const status = (opts.status ?? "").trim();
  if (status === "active" || status === "inactive") {
    params.push(status);
    conds.push(`u.status = $${params.length}`);
  }

  const role = (opts.role ?? "").trim();
  if (ROLE_CODES.has(role as Role)) {
    params.push(role);
    conds.push(
      `exists (select 1 from user_roles ur join roles r on r.id = ur.role_id where ur.user_id = u.id and r.code = $${params.length})`,
    );
  }

  const search = buildSearchConds(SEARCH_BLOB, opts.search, params.length);
  conds.push(...search.conds);
  params.push(...search.params);

  const whereSql = conds.length ? `where ${conds.join(" and ")}` : "";
  const sort = resolveSort(opts.sort, opts.dir, USER_SORTS, "name");
  const { limit, offset, page, pageSize } = resolvePage(opts.page, opts.pageSize);

  const [countResult, rowsResult] = await Promise.all([
    sql.query(
      `/* super_admin_users_paged_count */
       select count(*)::int as total from users u ${whereSql}`,
      params,
    ),
    sql.query(
      `/* super_admin_users_paged */
       select u.id, u.name, u.email, u.phone, u.status,
         u.app_login_id as "appLoginId",
         coalesce((
           select string_agg(r.code, ',' order by r.code)
           from user_roles ur join roles r on r.id = ur.role_id
           where ur.user_id = u.id
         ), '') as roles
       from users u
       ${whereSql}
       order by ${sort.expr} ${sort.dir} nulls last, u.name asc
       limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, limit, offset],
    ),
  ]);

  const [countRow] = countResult as Row[];
  const rows = rowsResult as Row[];

  return {
    users: rows.map((r) => ({
      id: str(r.id),
      name: str(r.name),
      email: nstr(r.email),
      phone: nstr(r.phone),
      status: str(r.status),
      appLoginId: nstr(r.appLoginId),
      roles: parseRoles(r.roles),
    })),
    total: num(countRow?.total),
    page,
    pageSize,
  };
}
