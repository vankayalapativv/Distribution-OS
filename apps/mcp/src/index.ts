import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { createMcpHandler } from "agents/mcp/server";
import { buildServer } from "./mcp";
import { authHandler } from "./auth";
import { OAuthKvDO, makeConsistentKV } from "./oauth-kv-do";
import { AuditLogDO } from "./audit-do";
import { MapsStoreDO } from "./maps-do";
import { ConfigDO } from "./config-do";
import { handleMapRoute } from "./map-route";
import { handleAdminRoute } from "./admin";

export { OAuthKvDO, AuditLogDO, MapsStoreDO, ConfigDO };

/**
 * Sri Aparajita MCP server — v2 STATELESS MCP behind an OAuth 2.1 passphrase gate.
 *
 * OAuth state (auth codes, grants, tokens) is stored in a single strongly
 * consistent Durable Object instead of Cloudflare KV, so the code written during
 * `/authorize` is immediately readable during `/token` from any region — fixing
 * the cross-region KV race that broke Claude's connection ("Grant not found").
 */
let currentEnv: Env | undefined;

const mcpHandler = createMcpHandler(() => buildServer(() => currentEnv!));

const apiHandler = {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    currentEnv = env;
    return mcpHandler(request, env, ctx);
  },
};

const provider = new OAuthProvider<Env>({
  apiRoute: "/mcp",
  apiHandler,
  defaultHandler: authHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
  scopesSupported: ["mcp:read"],
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Server-to-server admin API (`/admin/*`, bearer-gated) bypasses the OAuth gate.
    const adminResponse = await handleAdminRoute(request, env);
    if (adminResponse) return adminResponse;

    // Public, signed interactive map pages (`/m/<id>`) bypass the OAuth gate.
    const mapResponse = await handleMapRoute(request, env);
    if (mapResponse) return mapResponse;

    // Swap the provider's KV binding for the strongly-consistent DO-backed store.
    const stub = env.OAUTH_DO.get(env.OAUTH_DO.idFromName("oauth-store"));
    const patchedEnv: Env = { ...env, OAUTH_KV: makeConsistentKV(stub) };
    return provider.fetch(request, patchedEnv, ctx);
  },
};
