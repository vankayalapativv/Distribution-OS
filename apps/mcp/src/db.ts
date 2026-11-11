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
 * Run ONE read-only SQL statement against the Neon READ REPLICA.
 *
 * Read-only is guaranteed by the replica endpoint itself — it physically rejects
 * writes, so no statement can mutate data regardless of the connecting role.
 * Results are capped at ROW_CAP; `truncated` flags when more rows existed.
 */
export async function runReadOnlySql(databaseUrl: string, query: string): Promise<SqlResult> {
  const sql = neon(databaseUrl, {
    fetchOptions: { signal: AbortSignal.timeout(QUERY_TIMEOUT_MS) },
  });
  const started = Date.now();
  const rows = (await sql.query(query)) as Record<string, unknown>[];
  const elapsedMs = Date.now() - started;

  const truncated = rows.length > ROW_CAP;
  const capped = truncated ? rows.slice(0, ROW_CAP) : rows;
  const columns = capped.length > 0 ? Object.keys(capped[0]) : [];
  return { columns, rows: capped, rowCount: rows.length, truncated, elapsedMs };
}
