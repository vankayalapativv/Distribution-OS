import { timingSafeStringEqual } from "./passphrase";

/**
 * Server-to-server admin API for the inbound MCP server, consumed ONLY by the
 * main app's API (`apps/api`) on behalf of the Settings → MCP page — never by a
 * browser directly. Gated by a shared bearer secret (`MCP_ADMIN_SECRET`); the
 * secret is compared in constant time and never travels to the client.
 *
 * Mounted ahead of the OAuth provider (like the public map route), so `/admin/*`
 * bypasses the passphrase gate. Returns null for non-admin paths.
 *
 *   GET   /admin/status          → config + exposed tools + audit size
 *   PATCH /admin/config          → { enabled?, passphrase?, updatedBy? }
 *   GET   /admin/audit?limit=    → recent run_sql audit entries
 */

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function configStub(env: Env) {
  return env.CONFIG_DO.get(env.CONFIG_DO.idFromName("config"));
}

async function statusBody(env: Env) {
  const config = await configStub(env).get();
  let auditCount: number | null = null;
  try {
    auditCount = (await env.AUDIT_DO.get(env.AUDIT_DO.idFromName("audit")).recent(500)).length;
  } catch {
    auditCount = null;
  }
  return {
    enabled: config.enabled,
    // The access passphrase itself, so the admin can read/copy and share it.
    passphrase: config.passphrase,
    passphraseSet: config.passphrase !== null,
    passphraseSetAt: config.passphraseSetAt,
    usingEnvFallback: config.passphrase === null && Boolean(env.MCP_PASSPHRASE),
    updatedAt: config.updatedAt,
    updatedBy: config.updatedBy,
    serverUrl: env.PUBLIC_ORIGIN ?? null,
    mcpEndpoint: env.PUBLIC_ORIGIN ? `${env.PUBLIC_ORIGIN}/mcp` : null,
    replicaConfigured: Boolean(env.REPLICA_DATABASE_URL),
    auditCount,
  };
}

/** 503/401 Response when the admin bearer secret is unset or wrong; null when the
 *  request is authorized. The secret is compared in constant time. */
function adminAuthError(request: Request, env: Env): Response | null {
  // The admin API is unavailable unless the shared secret is configured.
  if (!env.MCP_ADMIN_SECRET) {
    return json({ error: "Admin API is not configured (MCP_ADMIN_SECRET unset)." }, 503);
  }
  const authz = request.headers.get("authorization") ?? "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : "";
  if (!token || !timingSafeStringEqual(token, env.MCP_ADMIN_SECRET)) {
    return json({ error: "Unauthorized." }, 401);
  }
  return null;
}

/** PATCH /admin/config — validate + apply { enabled?, passphrase?, updatedBy? }. */
async function handleConfigPatch(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  const patch: { enabled?: boolean; passphrase?: string | null } = {};
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (Object.prototype.hasOwnProperty.call(body, "passphrase")) {
    const pass = body.passphrase;
    if (pass === null || pass === "") {
      patch.passphrase = null; // clear → fall back to env (or no access if none)
    } else if (typeof pass === "string" && pass.length >= 8) {
      patch.passphrase = pass;
    } else {
      return json({ error: "Passphrase must be at least 8 characters (or null to clear)." }, 400);
    }
  }
  if (Object.keys(patch).length === 0) {
    return json({ error: "Nothing to update." }, 400);
  }
  const updatedBy = typeof body.updatedBy === "string" ? body.updatedBy : null;
  await configStub(env).update(patch, updatedBy);
  return json(await statusBody(env));
}

/** GET /admin/audit?limit= — recent run_sql audit entries (best-effort). */
async function handleAuditGet(url: URL, env: Env): Promise<Response> {
  const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") ?? 50) || 50, 500));
  let entries: unknown[] = [];
  try {
    entries = await env.AUDIT_DO.get(env.AUDIT_DO.idFromName("audit")).recent(limit);
  } catch {
    entries = [];
  }
  return json({ entries });
}

export async function handleAdminRoute(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/admin/")) return null;

  const authErr = adminAuthError(request, env);
  if (authErr) return authErr;

  if (url.pathname === "/admin/status" && request.method === "GET") return json(await statusBody(env));
  if (url.pathname === "/admin/config" && request.method === "PATCH") return handleConfigPatch(request, env);
  if (url.pathname === "/admin/audit" && request.method === "GET") return handleAuditGet(url, env);
  return json({ error: "Not found." }, 404);
}
