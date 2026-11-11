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

// ── Per-enterprise connector (Phase 4): THIS enterprise's own MCP passphrase ──
export interface McpPassphraseStatus {
  enabled: boolean;
  passphraseSet: boolean;
  passphraseSetAt: string | null;
  updatedAt: string | null;
  /** The connector address to paste into an AI client, or null if the server
   *  origin isn't configured (e.g. local dev). */
  mcpEndpoint: string | null;
}

export const getPassphrase = (cfg: ActionConfig) =>
  apiGet<McpPassphraseStatus>(cfg, "/mcp/passphrase");

/** Generate (or rotate) the passphrase — the plaintext is returned ONCE. */
export const generatePassphrase = (cfg: ActionConfig) =>
  apiRequest<{ passphrase: string }>(cfg, "POST", "/mcp/passphrase", {});

export const setPassphraseEnabled = (cfg: ActionConfig, enabled: boolean) =>
  apiRequest<McpPassphraseStatus>(cfg, "PATCH", "/mcp/passphrase", { enabled });
