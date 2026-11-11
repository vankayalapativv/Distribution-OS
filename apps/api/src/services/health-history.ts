import type { R2Bucket } from "@cloudflare/workers-types";
import type { HealthStatus } from "./health";

/**
 * 90-day uptime history for the /status page. Every monitor tick appends an
 * observation per component into a daily bucket, stored in R2 (`system/health.json`)
 * — DB-independent, so a database outage is still recorded. The /status endpoint
 * reads this to draw the per-component history bars + uptime %.
 */

export type ComponentKey = "api" | "database";

export const COMPONENTS: { key: ComponentKey; name: string; detail: string }[] = [
  { key: "api", name: "API", detail: "Application server" },
  { key: "database", name: "Database", detail: "Neon Postgres" },
];

export const RETENTION_DAYS = 90;
const STATE_KEY = "system/health.json";

export interface Observation {
  status: HealthStatus;
  latencyMs: number | null;
  observedAt: string;
}
interface DayBucket {
  checks: number;
  down: number;
  degraded: number;
}
export interface HealthState {
  current: Partial<Record<ComponentKey, Observation>>;
  days: Record<string, Partial<Record<ComponentKey, DayBucket>>>;
  notified?: { status: HealthStatus; since: string };
  updatedAt: string;
}

/** Calendar date (YYYY-MM-DD) in IST for a given instant. */
/* v8 ignore next -- the `= Date.now()` default-param initializer isn't instrumented by v8; every caller passes nowMs */
export function istDate(nowMs = Date.now()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(nowMs));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function istDateOffset(nowMs: number, deltaDays: number): string {
  return istDate(nowMs + deltaDays * 86_400_000);
}

/** Whether a YYYY-MM-DD calendar date is a Sunday (an office holiday, never monitored). */
function isSunday(date: string): boolean {
  return new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
}

export function emptyState(): HealthState {
  return { current: {}, days: {}, updatedAt: new Date(0).toISOString() };
}

export async function readState(bucket: R2Bucket): Promise<HealthState> {
  try {
    const obj = await bucket.get(STATE_KEY);
    if (obj) return JSON.parse(await obj.text()) as HealthState;
  } catch {
    // fall through to a fresh state
  }
  return emptyState();
}

export async function writeState(bucket: R2Bucket, state: HealthState): Promise<void> {
  try {
    await bucket.put(STATE_KEY, JSON.stringify(state), {
      httpMetadata: { contentType: "application/json" },
    });
  } catch {
    // best-effort — a failed write just means this tick isn't recorded
  }
}

/** Fold this tick's observations into `current` + today's daily buckets (mutates + returns). */
export function recordObservations(
  state: HealthState,
  obs: Partial<Record<ComponentKey, Observation>>,
  nowMs = Date.now(),
): HealthState {
  const date = istDate(nowMs);
  const day = (state.days[date] ??= {});
  for (const key of Object.keys(obs) as ComponentKey[]) {
    const o = obs[key];
    if (!o) continue;
    state.current[key] = o;
    const bucket = (day[key] ??= { checks: 0, down: 0, degraded: 0 });
    bucket.checks += 1;
    if (o.status === "down") bucket.down += 1;
    else if (o.status === "degraded") bucket.degraded += 1;
  }
  // Prune anything older than the retention window.
  const cutoff = istDateOffset(nowMs, -(RETENTION_DAYS - 1));
  for (const d of Object.keys(state.days)) if (d < cutoff) delete state.days[d];
  state.updatedAt = new Date(nowMs).toISOString();
  return state;
}

export type CellStatus = "ok" | "degraded" | "down" | "nodata";
export interface DayCell {
  date: string;
  status: CellStatus;
}
export interface ComponentSummary {
  key: ComponentKey;
  name: string;
  detail: string;
  currentStatus: HealthStatus | "unknown";
  latencyMs: number | null;
  observedAt: string | null;
  uptimePct: number | null;
  days: DayCell[];
}
export interface StatusSummary {
  overall: "ok" | "degraded" | "down";
  components: ComponentSummary[];
  windowDays: number;
  generatedAt: string;
}

/** Assemble the /status payload: per-component 90-day bars, uptime %, and overall. */
export function buildStatusSummary(
  state: HealthState,
  nowMs = Date.now(),
  windowDays = RETENTION_DAYS,
): StatusSummary {
  // Last `windowDays` calendar days, oldest → newest, with Sundays omitted
  // (monitoring is Mon–Sat, so a Sunday cell would always be empty).
  const dates: string[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const date = istDateOffset(nowMs, -i);
    if (!isSunday(date)) dates.push(date);
  }

  const components: ComponentSummary[] = COMPONENTS.map(({ key, name, detail }) => {
    let totalChecks = 0;
    let totalDown = 0;
    const days: DayCell[] = dates.map((date) => {
      const b = state.days[date]?.[key];
      if (!b || b.checks === 0) return { date, status: "nodata" };
      totalChecks += b.checks;
      totalDown += b.down;
      let status: CellStatus = "ok";
      if (b.down > 0) status = "down";
      else if (b.degraded > 0) status = "degraded";
      return { date, status };
    });
    const cur = state.current[key];
    return {
      key,
      name,
      detail,
      currentStatus: cur?.status ?? "unknown",
      latencyMs: cur?.latencyMs ?? null,
      observedAt: cur?.observedAt ?? null,
      uptimePct:
        totalChecks > 0 ? Math.round(((totalChecks - totalDown) / totalChecks) * 10000) / 100 : null,
      days,
    };
  });

  const statuses = components.map((c) => c.currentStatus);
  let overall: CellStatus = "ok";
  if (statuses.includes("down")) overall = "down";
  else if (statuses.includes("degraded")) overall = "degraded";
  return { overall, components, windowDays, generatedAt: new Date(nowMs).toISOString() };
}
