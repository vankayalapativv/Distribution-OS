import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import type { OAuthKvDO } from "./oauth-kv-do";
import type { AuditLogDO } from "./audit-do";
import type { MapsStoreDO } from "./maps-do";
import type { ConfigDO } from "./config-do";

/** Worker bindings. OAuth state lives in a strongly-consistent Durable Object. */
declare global {
  interface Env {
    /** Neon READ REPLICA connection string (secret). Read-only by endpoint. */
    REPLICA_DATABASE_URL: string;
    /** Legacy shared passphrase gating the OAuth login (secret). Used as a
     *  fallback until an admin rotates it from Settings → MCP (then the hash in
     *  CONFIG_DO wins). May be unset once a hashed passphrase is stored. */
    MCP_PASSPHRASE: string;
    /** Shared bearer secret for the server-to-server `/admin/*` API (secret).
     *  When unset the admin API returns 503 (feature simply unavailable). */
    MCP_ADMIN_SECRET: string;
    /** Durable Object holding the inbound-server config (enabled + passphrase hash). */
    CONFIG_DO: DurableObjectNamespace<ConfigDO>;
    /** Durable Object namespace backing the strongly-consistent OAuth store. */
    OAUTH_DO: DurableObjectNamespace<OAuthKvDO>;
    /** Durable Object namespace holding the query audit log. */
    AUDIT_DO: DurableObjectNamespace<AuditLogDO>;
    /** Durable Object namespace storing rendered map specs (for /m/<id>). */
    MAPS_DO: DurableObjectNamespace<MapsStoreDO>;
    /** HMAC secret for signing short-lived /m/<id> map links (secret). */
    MAP_SIGNING_SECRET: string;
    /** Public origin of this Worker, e.g. https://distribution-os-mcp.<acct>.workers.dev (var). */
    PUBLIC_ORIGIN: string;
    /** KVNamespace the OAuth provider reads — injected at runtime as a DO shim. */
    OAUTH_KV: KVNamespace;
    /** Injected by OAuthProvider — OAuth helper API used by the auth handler. */
    OAUTH_PROVIDER: OAuthHelpers;
  }
}

export {};
