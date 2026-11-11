import { verifyToken } from "./map-links";
import { mapPageHtml } from "./map-page";

/**
 * Serve the interactive map page at `GET /m/<id>?t=<token>` — public (no OAuth),
 * but gated by a signed, short-lived token. Returns null for non-map paths so the
 * caller falls through to the OAuth/MCP provider.
 */
export async function handleMapRoute(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/m\/([a-f0-9]{16,})$/);
  if (!match) return null;
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });

  const id = match[1];
  const token = url.searchParams.get("t") ?? "";
  if (!env.MAP_SIGNING_SECRET || !(await verifyToken(id, token, env.MAP_SIGNING_SECRET))) {
    return new Response("This map link is invalid or has expired.", { status: 403 });
  }
  const ns = env.MAPS_DO;
  const stored = await ns.get(ns.idFromName("maps")).get(id);
  if (!stored) return new Response("Map not found or expired.", { status: 404 });

  return new Response(mapPageHtml(stored.spec), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, max-age=300" },
  });
}
