/**
 * Shared server-side list helpers for the standard table stack (see
 * apps/web/AGENTS.md → "Data Tables"). Sorting is whitelisted so a client value
 * can never reach the SQL; paging is clamped to safe bounds. Reference use:
 * services/logistics.ts and services/customers.ts.
 */

/**
 * Resolve a client-supplied sort into a SAFE `ORDER BY` fragment. The column is
 * looked up in a whitelist of trusted SQL expressions (so it can be inlined);
 * the direction is clamped to asc/desc.
 */
export function resolveSort(
  sort: string | null | undefined,
  dir: string | null | undefined,
  allowed: Record<string, string>,
  fallback: string,
): { expr: string; dir: "asc" | "desc" } {
  const key = sort && Object.prototype.hasOwnProperty.call(allowed, sort) ? sort : fallback;
  const direction = String(dir ?? "").toLowerCase() === "asc" ? "asc" : "desc";
  return { expr: allowed[key], dir: direction };
}

/**
 * Split a free-text search into NORMALIZED tokens: lowercased, with every
 * non-alphanumeric character stripped, empties dropped. So "SUPER 4" → ["super",
 * "4"], "15W_40" → ["15w40"], and a pure "%" or "_" → [] (nothing to match).
 * Stripping non-alphanumerics also removes the ILIKE wildcards `%` and `_`, so a
 * term can never inject wildcards.
 */
export function searchTokens(search: string | null | undefined): string[] {
  return String(search ?? "")
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ""))
    .filter((t) => t.length > 0);
}

/**
 * Build AND-ed search conditions over a NORMALIZED blob expression (a trusted SQL
 * expression — built in code, never from client input — that lowercases its
 * columns and strips non-alphanumerics, mirroring {@link searchTokens}). Every
 * token must appear in the blob, so multi-word queries like "titan 15w40" match
 * across fields and "super 4"/"super4" both hit "SILKOLENE SUPER 4".
 *
 * `startIndex` is the number of params already bound; returns the new conditions
 * plus the `%token%` values to append (in the same order). No usable tokens →
 * no conditions (behaves like an empty search).
 */
export function buildSearchConds(
  blobExpr: string,
  search: string | null | undefined,
  startIndex: number,
): { conds: string[]; params: string[] } {
  const conds: string[] = [];
  const params: string[] = [];
  for (const tok of searchTokens(search)) {
    params.push(`%${tok}%`);
    conds.push(`${blobExpr} ilike $${startIndex + params.length}`);
  }
  return { conds, params };
}

/** Clamp paging into safe bounds. Default page size is 8 (the table standard). */
export function resolvePage(
  page: number | null | undefined,
  pageSize: number | null | undefined,
): { limit: number; offset: number; page: number; pageSize: number } {
  const ps = Math.min(Math.max(Math.trunc(Number(pageSize) || 8), 1), 100);
  const pg = Math.max(Math.trunc(Number(page) || 1), 1);
  return { limit: ps, offset: (pg - 1) * ps, page: pg, pageSize: ps };
}
