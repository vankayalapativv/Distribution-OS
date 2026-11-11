import { ApiError } from "../lib/errors";

/**
 * Proxy to the inbound MCP server's (`apps/mcp`) server-to-server `/admin/*`
 * API. The shared bearer secret (`MCP_ADMIN_SECRET`) never leaves the Worker —
 * the browser only ever sees the JSON these functions return.
 */
interface InboundEnv {
  MCP_SERVER_ORIGIN?: string;
  MCP_ADMIN_SECRET?: string;
}

export interface InboundStatus {
  configured: boolean;
  enabled: boolean;
  passphrase: string | null;
  passphraseSet: boolean;
  passphraseSetAt: string | null;
  usingEnvFallback: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
  serverUrl: string | null;
  mcpEndpoint: string | null;
  replicaConfigured: boolean;
  auditCount: number | null;
}

const ADMIN_TIMEOUT_MS = 10_000;

function origin(env: InboundEnv): { base: string; secret: string } | null {
  if (!env.MCP_SERVER_ORIGIN || !env.MCP_ADMIN_SECRET) return null;
  return { base: env.MCP_SERVER_ORIGIN.replace(/\/$/, ""), secret: env.MCP_ADMIN_SECRET };
}

async function adminFetch(
  env: InboundEnv,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<unknown> {
  const o = origin(env);
  if (!o) throw new ApiError("MCP_NOT_CONFIGURED", "The inbound MCP server is not wired to this API.", 503);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ADMIN_TIMEOUT_MS);
  try {
    const res = await fetch(`${o.base}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        authorization: `Bearer ${o.secret}`,
        ...(init?.body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const message = (json as { error?: string } | null)?.error ?? `MCP admin API responded ${res.status}.`;
      // Bad input the client can fix (400/422) surfaces as-is; anything else is
      // an upstream/server fault reported as 503 (502 isn't in ApiError's union).
      const status = res.status === 400 || res.status === 422 ? res.status : 503;
      throw new ApiError("MCP_ADMIN_ERROR", message, status);
    }
    return json;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    const aborted = e instanceof Error && e.name === "AbortError";
    throw new ApiError("MCP_UNREACHABLE", aborted ? "The MCP server did not respond." : "Could not reach the MCP server.", 503);
  } finally {
    clearTimeout(timer);
  }
}

/** Status, or a `configured:false` stub when the API isn't wired to the server. */
export async function getInboundStatus(env: InboundEnv): Promise<InboundStatus> {
  if (!origin(env)) {
    return {
      configured: false,
      enabled: false,
      passphrase: null,
      passphraseSet: false,
      passphraseSetAt: null,
      usingEnvFallback: false,
      updatedAt: null,
      updatedBy: null,
      serverUrl: null,
      mcpEndpoint: null,
      replicaConfigured: false,
      auditCount: null,
    };
  }
  const data = (await adminFetch(env, "/admin/status")) as Omit<InboundStatus, "configured">;
  return { configured: true, ...data };
}

export async function patchInboundConfig(
  env: InboundEnv,
  body: { enabled?: boolean; passphrase?: string | null; updatedBy?: string | null },
): Promise<InboundStatus> {
  const data = (await adminFetch(env, "/admin/config", { method: "PATCH", body })) as Omit<InboundStatus, "configured">;
  return { configured: true, ...data };
}

export async function getInboundAudit(env: InboundEnv, limit: number): Promise<{ entries: unknown[] }> {
  const data = (await adminFetch(env, `/admin/audit?limit=${limit}`)) as { entries?: unknown[] };
  return { entries: Array.isArray(data?.entries) ? data.entries : [] };
}
