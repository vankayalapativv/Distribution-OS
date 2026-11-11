import type { SqlClient } from "../lib/db";

/** One point-in-time read of whether the API can serve requests. */
export type HealthStatus = "ok" | "degraded" | "down";

export interface HealthSnapshot {
  status: HealthStatus;
  database: {
    configured: boolean;
    reachable: boolean;
    /** Round-trip of `select 1`, ms — null when the check failed. */
    latencyMs: number | null;
  };
  checkedAt: string;
}

/** Above this DB round-trip we call the service "degraded" (slow but up). */
export const DEFAULT_DEGRADED_MS = 2000;
/** A `select 1` slower than this is treated as a hung DB → "down". */
const DEFAULT_TIMEOUT_MS = 6000;

/**
 * Probe the database with a bounded `select 1` and classify the result. Never
 * throws — a dead / hung DB resolves to `status: "down"` so callers (the
 * `/health` endpoint and the monitor cron) can report rather than crash.
 */
export async function checkHealth(
  sql: SqlClient | null,
  opts: { degradedMs?: number; timeoutMs?: number } = {},
): Promise<HealthSnapshot> {
  const checkedAt = new Date().toISOString();

  if (!sql) {
    return {
      status: "down",
      database: { configured: false, reachable: false, latencyMs: null },
      checkedAt,
    };
  }

  const degradedMs = opts.degradedMs ?? DEFAULT_DEGRADED_MS;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const start = Date.now();

  try {
    await Promise.race([
      sql`/* health_check */ select 1 as ok`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("health check timed out")), timeoutMs),
      ),
    ]);
    const latencyMs = Date.now() - start;
    return {
      status: latencyMs > degradedMs ? "degraded" : "ok",
      database: { configured: true, reachable: true, latencyMs },
      checkedAt,
    };
  } catch {
    return {
      status: "down",
      database: { configured: true, reachable: false, latencyMs: null },
      checkedAt,
    };
  }
}

/** Read the degraded threshold from env (string), falling back to the default. */
export function degradedMsFromEnv(env: { HEALTH_DEGRADED_MS?: string }): number {
  const parsed = Number(env.HEALTH_DEGRADED_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DEGRADED_MS;
}
