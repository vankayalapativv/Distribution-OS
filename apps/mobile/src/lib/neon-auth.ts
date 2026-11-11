/**
 * Auth client (mobile) — Phase 2: the device no longer calls the Neon Auth host
 * (`…aws.neon.tech`) directly. Weak-4G DNS often failed to resolve that deep AWS
 * hostname, causing login failures and token-refresh logouts. Instead we call
 * our own API (the reliable Cloudflare `…workers.dev` host), and the Worker does
 * the Neon REST calls server-to-server (apps/api/src/routes/auth.ts).
 *
 * The exported surface is unchanged from the old direct-to-Neon client, so the
 * auth store / session guard / token-refresh wiring is untouched:
 *  - neonSignIn        → POST /auth/login   → { session, user }
 *  - neonJwtFromSession→ POST /auth/token   → fresh JWT (or null)
 *  - neonProbeSession  → POST /auth/token   → active | revoked | unavailable
 *  - neonSignOut       → POST /auth/sign-out
 */
import Constants from "expo-constants";
import * as Device from "expo-device";
import { API_BASE_URL, ApiRequestError } from "./api-core";

// A stalled connect must fail fast (fetch has no default timeout).
const AUTH_TIMEOUT_MS = 15_000;
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * A descriptive device string sent with sign-in so the admin web "Manage
 * sessions" screen can name the phone this session signed in from. The API
 * forwards it as the session's user-agent to Neon Auth; the web `describeDevice`
 * parses this exact shape. okhttp strips a custom User-Agent header on some
 * Android builds, so we send it in the body instead of as a header.
 * Shape: `DistributionOS/<appVersion> (Android <os>; <manufacturer>; <model>)`.
 */
function deviceUserAgent(): string {
  const version = Constants.expoConfig?.version ?? "0";
  const os = Device.osVersion ?? "?";
  const manufacturer = Device.manufacturer ?? "Unknown";
  const model = Device.modelName ?? "device";
  return `DistributionOS/${version} (Android ${os}; ${manufacturer}; ${model})`;
}

/** fetch to our API with a hard timeout. */
async function authFetch(path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);
  try {
    return await fetch(`${API_BASE_URL}${path}`, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const jsonInit = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

interface Envelope<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
}

async function parseEnvelope<T>(res: Response): Promise<Envelope<T>> {
  try {
    return (await res.json()) as Envelope<T>;
  } catch {
    throw new ApiRequestError("NON_JSON_RESPONSE", `Request failed with status ${res.status}.`, res.status);
  }
}

export interface NeonUser {
  id: string;
  name: string;
  email: string;
}

export async function neonSignIn(
  identifier: string,
  password: string,
): Promise<{ session: string; user: NeonUser }> {
  // Retry ONLY the network attempt (transient 4G/DNS) up to 3 tries; a non-OK
  // HTTP response (wrong password) is deterministic and handled without retry.
  let res: Response;
  for (let attempt = 0; ; attempt++) {
    try {
      res = await authFetch("/auth/login", jsonInit({ identifier, password, device: deviceUserAgent() }));
      break;
    } catch (e) {
      if (attempt >= 2) throw e; // surfaced to the login screen (humanized there)
      await delay(400 * (attempt + 1));
    }
  }

  const body = await parseEnvelope<{ session: string; token: string | null; user: NeonUser }>(res);
  if (!res.ok || !body.success) {
    throw new ApiRequestError(
      body.error?.code ?? "UNAUTHORIZED",
      body.error?.message ?? "Invalid email or password.",
      res.status,
    );
  }
  if (!body.data?.session || !body.data?.user) {
    throw new ApiRequestError("AUTH_ERROR", "Sign-in did not return a session.", 500);
  }
  return { session: body.data.session, user: body.data.user };
}

/** Mint a fresh API JWT from a stored session — null if none/revoked/unreachable. */
export async function neonJwtFromSession(session: string): Promise<string | null> {
  try {
    const res = await authFetch("/auth/token", jsonInit({ session }));
    if (!res.ok) return null;
    const body = await parseEnvelope<{ status: string; token?: string }>(res);
    return body.success && body.data?.status === "active" ? (body.data.token ?? null) : null;
  } catch {
    return null;
  }
}

/**
 * Probe a stored session and classify it (for the session guard + token
 * refresh): "active" (token to adopt), "revoked" (definitively dead → log out),
 * or "unavailable" (couldn't reach the API / inconclusive → keep signed in).
 * A thrown fetch (device offline) is "unavailable" — never a logout.
 */
export async function neonProbeSession(
  session: string,
): Promise<{ status: "active" | "revoked" | "unavailable"; token: string | null }> {
  try {
    const res = await authFetch("/auth/token", jsonInit({ session }));
    if (!res.ok) return { status: "unavailable", token: null };
    const body = await parseEnvelope<{ status: "active" | "revoked" | "unavailable"; token?: string }>(res);
    if (!body.success) return { status: "unavailable", token: null };
    if (body.data?.status === "active" && body.data.token) {
      return { status: "active", token: body.data.token };
    }
    if (body.data?.status === "revoked") return { status: "revoked", token: null };
    return { status: "unavailable", token: null };
  } catch {
    return { status: "unavailable", token: null };
  }
}

export async function neonSignOut(session: string): Promise<void> {
  try {
    await authFetch("/auth/sign-out", jsonInit({ session }));
  } catch {
    /* best-effort */
  }
}
