import { type ActionConfig, apiGet, apiRequest } from "@/lib/api-client";

// Inbound server (apps/mcp) — expose this app to AI clients.
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

export interface AuditEntry {
  ts: string;
  ok: boolean;
  rowCount: number | null;
  truncated: boolean;
  elapsedMs: number | null;
  sql: string;
  error?: string;
}

export const getServer = (cfg: ActionConfig) => apiGet<InboundStatus>(cfg, "/mcp/server");

export const patchServer = (cfg: ActionConfig, body: { enabled?: boolean; passphrase?: string | null }) =>
  apiRequest<InboundStatus>(cfg, "PATCH", "/mcp/server", body);

export const getServerAudit = (cfg: ActionConfig, limit = 50) =>
  apiGet<{ entries: AuditEntry[] }>(cfg, `/mcp/server/audit?limit=${limit}`);
