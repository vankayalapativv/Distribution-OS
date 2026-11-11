import { neon } from "@neondatabase/serverless";

/** Hard row cap returned to the model (spec §1). Larger results are truncated. */
const ROW_CAP = 5000;
/** Client-side query timeout guard (ms) — aborts the HTTP call (spec §1). */
const QUERY_TIMEOUT_MS = 15_000;

export interface SqlResult {
  columns: string[];
  rows: Record<string, unknown>[];
  /** Total rows the query produced (before the row cap). */
  rowCount: number;
  /** True when rowCount > ROW_CAP and `rows` was trimmed. */
  truncated: boolean;
  elapsedMs: number;
}

/**
 * Run ONE read-only SQL statement against the Neon READ REPLICA, SCOPED to one
 * enterprise.
 *
 * Isolation has two layers, both required:
 *   1. The replica endpoint physically rejects writes (read-only, belt).
 *   2. Every statement runs inside a single HTTP transaction that first drops to
 *      the low-privilege `app_readonly` role and sets `app.enterprise_id`, so
 *      Postgres RLS filters every row to this enterprise (braces). The connecting
 *      role bypasses RLS as owner, so WITHOUT the `SET LOCAL ROLE` the query would
 *      see every enterprise — the role switch is the real tenant boundary.
 *
 * `enterpriseId` must be a resolved uuid (from the passphrase). Results are capped
 * at ROW_CAP; `truncated` flags when more rows existed.
 */
export async function runReadOnlySql(
  databaseUrl: string,
  enterpriseId: string,
  query: string,
): Promise<SqlResult> {
  const sql = neon(databaseUrl, {
    fetchOptions: { signal: AbortSignal.timeout(QUERY_TIMEOUT_MS) },
  });
  const started = Date.now();
  // One round-trip: become app_readonly (RLS applies), pin the enterprise, run
  // the user's query. The last statement's rows are the result.
  const results = (await sql.transaction([
    sql`set local role app_readonly`,
    sql`select set_config('app.enterprise_id', ${enterpriseId}, true)`,
    sql.query(query),
  ])) as unknown as Record<string, unknown>[][];
  const elapsedMs = Date.now() - started;
  const rows = (results[results.length - 1] ?? []) as Record<string, unknown>[];

  const truncated = rows.length > ROW_CAP;
  const capped = truncated ? rows.slice(0, ROW_CAP) : rows;
  const columns = capped.length > 0 ? Object.keys(capped[0]) : [];
  return { columns, rows: capped, rowCount: rows.length, truncated, elapsedMs };
}

/** Lowercase hex SHA-256 of a string (Web Crypto — Workers-native). */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Resolve a submitted MCP passphrase to its enterprise_id, or null when it
 * matches no enabled enterprise. Uses the SECURITY DEFINER resolver so the lookup
 * works before any enterprise scope exists and never exposes the hash list.
 */
export async function resolveEnterpriseByPassphrase(
  databaseUrl: string,
  passphrase: string,
): Promise<string | null> {
  const hash = await sha256Hex(passphrase);
  const sql = neon(databaseUrl, { fetchOptions: { signal: AbortSignal.timeout(QUERY_TIMEOUT_MS) } });
  const rows = (await sql`select public.mcp_resolve_enterprise(${hash}) as eid`) as Array<{ eid: string | null }>;
  return rows[0]?.eid ?? null;
}
