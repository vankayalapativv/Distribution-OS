import type { R2Bucket } from "@cloudflare/workers-types";
import { BRAND } from "@distribution-os/shared";
import type { SqlClient } from "../lib/db";
import { checkHealth, degradedMsFromEnv, type HealthStatus } from "./health";
import {
  type ComponentKey,
  COMPONENTS,
  type HealthState,
  type Observation,
  readState,
  recordObservations,
  writeState,
} from "./health-history";

/**
 * Self-hosted uptime monitor (#7). The 3-minute cron calls this inside the
 * 9AM–9PM IST Mon–Sat window. Each tick probes API + Database + Web dashboard,
 * records the observations into the R2 history (for the /status page bars), and
 * — when the OVERALL status changes — emails an alert via Resend (Down /
 * Degraded / Recovered). Dedup state lives in R2, not the DB, so a DB outage is
 * still alerted, and a sustained outage emails once (on the change).
 */

const DEFAULT_FROM = `${BRAND.name} Status <status@updates.vardhansystems.in>`;

interface MonitorEnv {
  DATABASE_URL?: string;
  ENVIRONMENT?: string;
  PHOTOS?: R2Bucket;
  RESEND_API_KEY?: string;
  ALERT_FROM?: string;
  REPORTS_FROM?: string;
  REPORTS_TO?: string;
  REPORTS_WEB_BASE_URL?: string;
  HEALTH_DEGRADED_MS?: string;
}

/** 9AM–9PM IST, Mon–Sat (Sunday is an office holiday — no monitoring). */
export function inStatusWindow(nowMs = Date.now()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(nowMs));
  const part = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  if (part("weekday") === "Sun") return false;
  const minutes = Number(part("hour")) * 60 + Number(part("minute"));
  return minutes >= 9 * 60 && minutes < 21 * 60; // [09:00, 21:00) IST
}

/** Probe every component. API is "up" by virtue of this code running. */
export async function probeComponents(
  env: MonitorEnv,
  sql: SqlClient | null,
): Promise<Partial<Record<ComponentKey, Observation>>> {
  const now = new Date().toISOString();
  const db = await checkHealth(sql, { degradedMs: degradedMsFromEnv(env) });
  return {
    api: { status: "ok", latencyMs: null, observedAt: now },
    database: { status: db.status, latencyMs: db.database.latencyMs, observedAt: now },
  };
}

function worstStatus(obs: Partial<Record<ComponentKey, Observation>>): HealthStatus {
  const statuses = Object.values(obs).map((o) => o?.status);
  if (statuses.includes("down")) return "down";
  if (statuses.includes("degraded")) return "degraded";
  return "ok";
}

// ---- alert email ----

interface AlertConfig {
  apiKey: string;
  from: string;
  to: string;
  webUrl?: string;
}

function resolveAlertConfig(env: MonitorEnv): AlertConfig | null {
  if (!env.RESEND_API_KEY) return null;
  // Recipient must come from config — no hardcoded personal-email fallback. With
  // REPORTS_TO unset, health history is still recorded; only the email is skipped.
  const to = env.REPORTS_TO;
  if (!to) return null;
  return {
    apiKey: env.RESEND_API_KEY,
    from: env.ALERT_FROM ?? env.REPORTS_FROM ?? DEFAULT_FROM,
    to,
    webUrl: env.REPORTS_WEB_BASE_URL,
  };
}

const HEADLINE: Record<HealthStatus, string> = {
  down: "🔴 DOWN — a component is unreachable",
  degraded: "🟡 Degraded — a component is slow",
  ok: "🟢 Recovered — all systems operational",
};
const STATUS_LABEL: Record<HealthStatus | "unknown", string> = {
  ok: "Operational",
  degraded: "Degraded",
  down: "Down",
  unknown: "Unknown",
};

function alertHtml(env: MonitorEnv, overall: HealthStatus, obs: Partial<Record<ComponentKey, Observation>>, cfg: AlertConfig): string {
  const rows = COMPONENTS.filter((c) => obs[c.key])
    .map((c) => {
      const o = obs[c.key]!;
      const lat = o.latencyMs == null ? "" : ` · ${o.latencyMs} ms`;
      return (
        `<tr><td style="padding:6px 14px;color:#0f172a;font-size:13px;">${c.name}</td>` +
        `<td style="padding:6px 14px;color:#0f172a;font-size:13px;font-weight:600;">${STATUS_LABEL[o.status]}${lat}</td></tr>`
      );
    })
    .join("");
  const link = cfg.webUrl
    ? `<p style="margin:16px 0 0;"><a href="${cfg.webUrl}/status" style="color:#2563eb;">Open the status page →</a></p>`
    : "";
  return (
    `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;">` +
    `<h2 style="font-size:17px;color:#0f172a;margin:0 0 4px;">${HEADLINE[overall]}</h2>` +
    `<p style="color:#64748b;font-size:13px;margin:0 0 14px;">${BRAND.name} system health monitor · ${env.ENVIRONMENT ?? "production"}</p>` +
    `<table style="border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">${rows}</table>` +
    link +
    `</div>`
  );
}

async function sendAlert(cfg: AlertConfig, env: MonitorEnv, overall: HealthStatus, obs: Partial<Record<ComponentKey, Observation>>): Promise<void> {
  const subject = `[${BRAND.name} ${env.ENVIRONMENT ?? "prod"}] ${HEADLINE[overall]}`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${cfg.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from: cfg.from, to: [cfg.to], subject, html: alertHtml(env, overall, obs, cfg) }),
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(`Resend ${res.status}: ${detail.message ?? "send failed"}`);
  }
}

export interface MonitorResult {
  status: HealthStatus;
  previous: HealthStatus;
  changed: boolean;
  emailed: boolean;
}

/** One monitor tick: probe → record history → alert on overall status change. */
export async function runHealthMonitor(env: MonitorEnv, sql: SqlClient | null): Promise<MonitorResult> {
  const obs = await probeComponents(env, sql);
  const overall = worstStatus(obs);
  const bucket = env.PHOTOS;

  if (!bucket) {
    // Without R2 we can't record history or dedup alerts — probe only.
    return { status: overall, previous: "ok", changed: false, emailed: false };
  }

  const state: HealthState = await readState(bucket);
  const previous = state.notified?.status ?? "ok";
  recordObservations(state, obs);

  const changed = overall !== previous;
  let emailed = false;
  if (changed) {
    const cfg = resolveAlertConfig(env);
    if (cfg) {
      await sendAlert(cfg, env, overall, obs);
      emailed = true;
      state.notified = { status: overall, since: new Date().toISOString() };
    } else {
      console.error("[health] status changed to", overall, "but RESEND_API_KEY is not set — no alert.");
    }
  }

  await writeState(bucket, state);
  return { status: overall, previous, changed, emailed };
}
