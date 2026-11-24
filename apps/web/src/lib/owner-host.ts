/**
 * The platform-owner cockpit runs on its OWN subdomain
 * (owner.distributionos.vardhansystems.in) served by the SAME web worker, so the
 * owner's `sa_session` cookie is host-only and never clobbers a tenant's apex
 * session. `OWNER_HOST` is a plaintext wrangler var; the literal is the fallback
 * for local/dev and preview. The cockpit lives under the `/owner` URL segment;
 * middleware rewrites the owner host's paths into that segment.
 */
export const OWNER_HOST = (process.env.OWNER_HOST ?? "owner.distributionos.vardhansystems.in").toLowerCase();

/** The URL prefix every cockpit page lives under (an actual route segment, since
 *  App Router can't address a bare route group by path). */
export const OWNER_PREFIX = "/owner";

/** Strip the port and lowercase a Host header for comparison. */
export function normalizeHost(host: string | null | undefined): string {
  return (host ?? "").split(":")[0].trim().toLowerCase();
}

/** Whether a Host header is the owner subdomain. Local dev can use
 *  `owner.localhost` to exercise the cockpit without the real subdomain. */
export function isOwnerHost(host: string | null | undefined): boolean {
  const h = normalizeHost(host);
  return h === OWNER_HOST || h === "owner.localhost";
}
