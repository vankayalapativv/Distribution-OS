import { AuthorizationError, type AuthRequest } from "@cloudflare/workers-oauth-provider";
import { timingSafeStringEqual } from "./passphrase";

/** A short page shown when the server is disabled, so the form can't be used. */
function disabledPage(): Response {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Sri Aparajita MCP — unavailable</title>
<style>:root{color-scheme:light dark}body{font-family:ui-sans-serif,system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:Canvas;color:CanvasText}.card{width:min(380px,92vw);border:1px solid color-mix(in srgb,CanvasText 15%,transparent);border-radius:14px;padding:28px 26px;text-align:center}h1{font-size:18px;margin:0 0 8px}p{color:color-mix(in srgb,CanvasText 60%,transparent);font-size:13.5px;margin:0}</style>
</head><body><div class="card"><h1>Sri Aparajita MCP</h1><p>This connector is currently turned off. Ask an administrator to enable it in Settings → MCP.</p></div></body></html>`;
  return new Response(html, { status: 403, headers: { "content-type": "text/html; charset=utf-8" } });
}

/** Resolve the effective passphrase check from the config DO, falling back to
 *  the legacy env secret until an admin sets one from the web. */
async function passphraseAccepted(env: Env, candidate: string): Promise<boolean> {
  const config = await env.CONFIG_DO.get(env.CONFIG_DO.idFromName("config")).get();
  if (!config.enabled) return false;
  if (config.passphrase) return timingSafeStringEqual(candidate, config.passphrase);
  return Boolean(env.MCP_PASSPHRASE) && timingSafeStringEqual(candidate, env.MCP_PASSPHRASE);
}

/**
 * Passphrase login page rendered on /authorize. The form POSTs back to the same
 * URL (query string preserved) so the OAuth parameters survive the round-trip.
 */
function loginPage(actionUrl: string, clientName: string | undefined, error: string | null): Response {
  const client = clientName ? clientName.replace(/[<>&]/g, "") : "An application";
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sri Aparajita MCP — sign in</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: ui-sans-serif, system-ui, sans-serif; display: grid; place-items: center;
           min-height: 100vh; margin: 0; background: Canvas; color: CanvasText; }
    .card { width: min(380px, 92vw); border: 1px solid color-mix(in srgb, CanvasText 15%, transparent);
            border-radius: 14px; padding: 28px 26px; box-shadow: 0 8px 30px rgba(0,0,0,.08); }
    h1 { font-size: 18px; margin: 0 0 4px; }
    p { color: color-mix(in srgb, CanvasText 60%, transparent); font-size: 13.5px; margin: 0 0 20px; }
    label { display: block; font-size: 13px; margin-bottom: 6px; }
    input { width: 100%; box-sizing: border-box; padding: 10px 12px; font-size: 15px; border-radius: 9px;
            border: 1px solid color-mix(in srgb, CanvasText 25%, transparent); background: Field; color: FieldText; }
    button { width: 100%; margin-top: 16px; padding: 11px; font-size: 15px; font-weight: 600; border: 0;
             border-radius: 9px; background: #2563eb; color: #fff; cursor: pointer; }
    .err { color: #dc2626; font-size: 13px; margin: 10px 0 0; }
  </style>
</head>
<body>
  <form class="card" method="POST" action="${actionUrl}">
    <h1>Sri Aparajita MCP</h1>
    <p><strong>${client}</strong> wants to connect to your business data (read-only). Enter the passphrase to allow it.</p>
    <label for="passphrase">Passphrase</label>
    <input id="passphrase" name="passphrase" type="password" autocomplete="current-password" autofocus required />
    ${error ? `<p class="err">${error}</p>` : ""}
    <button type="submit">Allow access</button>
  </form>
</body>
</html>`;
  return new Response(html, {
    status: error ? 401 : 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

/** Turn an OAuth AuthorizationError into its response: a 400 when there's no
 *  redirect URI, else a 302 back to the client carrying the error params. */
function authErrorResponse(error: AuthorizationError): Response {
  if (!error.redirectUri) return new Response(error.description, { status: 400 });
  const redirect = new URL(error.redirectUri);
  redirect.searchParams.set("error", error.code);
  redirect.searchParams.set("error_description", error.description);
  if (error.state) redirect.searchParams.set("state", error.state);
  if (error.issuer) redirect.searchParams.set("iss", error.issuer);
  return Response.redirect(redirect.toString(), 302);
}

/**
 * OAuth `defaultHandler` — serves /authorize with a passphrase gate. On the
 * correct passphrase it completes the authorization; anything else re-prompts.
 * Everything else 404s (the provider serves /token, /register, and metadata).
 */
export const authHandler: ExportedHandler<Env> = {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response("Sri Aparajita MCP server — add as a custom connector pointing at /mcp", {
        headers: { "content-type": "text/plain" },
      });
    }
    if (url.pathname !== "/authorize") return new Response("Not found", { status: 404 });

    let oauthRequest: AuthRequest;
    try {
      oauthRequest = await env.OAUTH_PROVIDER.parseAuthRequest(request);
    } catch (error) {
      if (!(error instanceof AuthorizationError)) throw error;
      return authErrorResponse(error);
    }

    const client = await env.OAUTH_PROVIDER.lookupClient(oauthRequest.clientId);
    if (!client) return new Response("Unknown OAuth client", { status: 400 });

    // Master switch: a disabled server never shows the login form.
    const config = await env.CONFIG_DO.get(env.CONFIG_DO.idFromName("config")).get();
    if (!config.enabled) return disabledPage();

    const actionUrl = url.pathname + url.search;
    if (request.method !== "POST") {
      return loginPage(actionUrl, client.clientName, null);
    }

    const form = await request.formData();
    const passphrase = String(form.get("passphrase") ?? "");
    if (!(await passphraseAccepted(env, passphrase))) {
      return loginPage(actionUrl, client.clientName, "Incorrect passphrase. Try again.");
    }

    const scope = oauthRequest.scope.filter((s) => s === "mcp:read");
    const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
      request: oauthRequest,
      userId: "sri-aparajita-owner",
      metadata: { clientName: client.clientName },
      scope: scope.length ? scope : ["mcp:read"],
      props: { userId: "sri-aparajita-owner" },
    });
    return Response.redirect(redirectTo, 302);
  },
};
