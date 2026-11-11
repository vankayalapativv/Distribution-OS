/**
 * Neon access-token refresh (mobile) — the single-flight + proactive-expiry
 * policy. Deliberately free of React Native / expo-secure-store imports so the
 * API client (which uses it) stays unit-testable in plain Node; the actual mint
 * (read Neon session → mint JWT → persist → adopt) is injected by the auth
 * store via setTokenMinter.
 *
 * The API access token is a short-lived (~15 min) EdDSA JWT minted from the
 * long-lived Neon session captured at sign-in. Two paths keep an active field
 * user authenticated without a re-login:
 *
 *  - PROACTIVE: before a request goes out, if the current token is within
 *    PROACTIVE_SKEW_MS of expiry, mint a fresh one first (ensureFreshToken).
 *  - REACTIVE: a request that still 401s triggers a mint-and-retry in the API
 *    client (refreshAccessToken).
 *
 * If the session is dead/revoked (handover), the minter returns null and the
 * API client soft-expires the session (routes to login).
 */

/**
 * The result of a refresh attempt — a THREE-way answer so the API client can
 * tell a genuinely dead session apart from a mere network outage (a field rep in
 * a dead zone / a flaky-DNS 4G network). Only "revoked" should log the user out:
 *  - "active"      → a fresh JWT was minted (carried in `token`).
 *  - "revoked"     → Neon definitively refused the session (401/403) — it's gone.
 *  - "unavailable" → couldn't reach Neon (network/DNS/timeout) — keep the user
 *                    signed in and fail the current request soft.
 */
export type RefreshOutcome =
  | { status: "active"; token: string }
  | { status: "revoked" }
  | { status: "unavailable" };

/** Reads the Neon session, mints + persists a fresh JWT, adopts it into the
 *  store, and returns the outcome (see RefreshOutcome). */
type TokenMinter = () => Promise<RefreshOutcome>;

let minter: TokenMinter | null = null;
export function setTokenMinter(fn: TokenMinter): void {
  minter = fn;
}

let inFlight: Promise<RefreshOutcome> | null = null;

/**
 * Mint a fresh access token from the stored Neon session. Single-flight: a burst
 * of concurrent 401s (or proactive checks) all await ONE mint, not one each.
 * A thrown minter (unexpected) is treated as "unavailable" — never a logout.
 */
export function refreshAccessToken(): Promise<RefreshOutcome> {
  if (inFlight) return inFlight;
  const run = minter;
  if (!run) return Promise.resolve({ status: "revoked" });
  inFlight = (async () => {
    try {
      return await run();
    } catch {
      return { status: "unavailable" };
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Decode a JWT's `exp` as epoch-ms; null if unparseable. */
function jwtExpMs(token: string): number | null {
  try {
    if (typeof atob !== "function") return null; // Hermes/Node have atob; degrade safely
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
    const obj = JSON.parse(atob(padded)) as { exp?: number };
    return typeof obj.exp === "number" ? obj.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Refresh when this little (or less) is left on the token. */
const PROACTIVE_SKEW_MS = 120_000;

/**
 * Return a token safe to send right now: the current one if it has comfortable
 * life left (or its expiry can't be read), otherwise a freshly-minted one.
 * Never returns null while the caller has a token — falls back to the current
 * token if the proactive mint fails, letting the reactive 401 path handle it.
 */
export async function ensureFreshToken(current: string | null): Promise<string | null> {
  if (!current) return current;
  const expMs = jwtExpMs(current);
  if (expMs == null) return current;
  if (expMs - Date.now() > PROACTIVE_SKEW_MS) return current;
  const r = await refreshAccessToken();
  // Keep the current token on "revoked"/"unavailable" — the reactive 401 path
  // decides whether to actually expire; proactive must never drop a session.
  return r.status === "active" ? r.token : current;
}
