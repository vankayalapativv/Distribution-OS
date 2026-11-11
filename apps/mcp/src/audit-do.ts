import { DurableObject } from "cloudflare:workers";

/** One recorded query. No per-user field — both people share one passphrase. */
export interface AuditEntry {
  ts: string; // ISO timestamp
  ok: boolean;
  rowCount: number | null;
  truncated: boolean;
  elapsedMs: number | null;
  sql: string;
  error?: string;
}

const MAX_ENTRIES = 500;
const SQL_MAX = 2000;

/**
 * Append-only audit log of every `run_sql` call, kept in a single Durable Object
 * (strongly consistent, off-database — the Neon replica is read-only so the log
 * can't live there). Holds the most recent MAX_ENTRIES, newest first.
 */
export class AuditLogDO extends DurableObject {
  async log(entry: AuditEntry): Promise<void> {
    const list = (await this.ctx.storage.get<AuditEntry[]>("entries")) ?? [];
    list.unshift({ ...entry, sql: entry.sql.slice(0, SQL_MAX) });
    if (list.length > MAX_ENTRIES) list.length = MAX_ENTRIES;
    await this.ctx.storage.put("entries", list);
  }

  async recent(limit: number): Promise<AuditEntry[]> {
    const list = (await this.ctx.storage.get<AuditEntry[]>("entries")) ?? [];
    return list.slice(0, Math.max(1, Math.min(limit, MAX_ENTRIES)));
  }
}
