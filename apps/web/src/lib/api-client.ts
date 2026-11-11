/**
 * Shared client-side API helper. Every feature used to define its own copy of
 * this (13 of them); import from here instead.
 *
 * `actionConfig` ({ apiBaseUrl, authToken }) is passed from the server page down
 * to client components — see apps/web/AGENTS.md "Auth Pattern".
 */

export interface ActionConfig {
  apiBaseUrl: string;
  authToken: string;
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}

export type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Error thrown for a non-OK API response, carrying the HTTP `status` so callers
 * (and the React Query retry policy) can act on it — e.g. NOT retry a 402
 * billing block or a 401/403/404, which won't change by trying again.
 */
export class ApiRequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

/** True for a response status that a retry cannot fix (auth, billing, missing,
 *  validation) — as opposed to a transient 5xx/network error. */
export function isNonRetryableStatus(status: number): boolean {
  return status === 401 || status === 402 || status === 403 || status === 404 || status === 422;
}

/**
 * A hung API/DB must fail fast instead of freezing the tab — plain `fetch` has
 * no timeout. The abort stays armed THROUGH the body read (`response.json()`),
 * so a stalled response body can't hang forever either.
 */
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Silent token refresh.
 *
 * The server hands the browser a short-lived (~15 min) API token at page render.
 * When it expires, calls 401. Rather than force a full reload, we mint a fresh
 * token from the still-valid session (`GET /api/auth/token`) and retry once.
 * `liveToken`, once refreshed, is used by every subsequent call (it overrides
 * the stale token captured in each component's `actionConfig`). The refresh is
 * deduped so a burst of concurrent 401s triggers exactly one round-trip.
 */
let liveToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;

function refreshAuthToken(): Promise<string | null> {
  refreshInFlight ??= (async () => {
    try {
      const res = await fetch("/api/auth/token", { cache: "no-store" });
      if (!res.ok) return null; // session itself is gone
      const body = (await res.json()) as { token?: string };
      liveToken = body.token ?? null;
      return liveToken;
    } catch {
      return null;
    }
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function apiRequest<T>(
  config: ActionConfig,
  method: ApiMethod,
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  // Prefer the freshest token we hold; fall back to the one baked into props.
  return requestWithToken<T>(config, method, path, body, liveToken ?? config.authToken, false);
}

/** On a 401, swap in a fresh token and retry once; if the session is truly gone,
 *  bounce to /login and surface a clear expired-session error. */
async function retryWithFreshToken<T>(
  config: ActionConfig,
  method: ApiMethod,
  path: string,
  body: Record<string, unknown> | undefined,
): Promise<T> {
  const fresh = await refreshAuthToken();
  if (fresh) return requestWithToken<T>(config, method, path, body, fresh, true);
  // The session itself has expired — send the user to sign in again.
  if (typeof window !== "undefined") window.location.href = "/login";
  throw new ApiRequestError("Your session has expired. Please sign in again.", 401);
}

/** Build an ApiRequestError from a non-ok response, preferring the API's own
 *  message when the body is JSON. */
async function toApiError(response: Response): Promise<ApiRequestError> {
  let message = `Request failed with status ${response.status}`;
  try {
    const err = (await response.json()) as { error?: { message?: string } };
    if (err?.error?.message) message = err.error.message;
  } catch {
    // response body wasn't JSON — keep the status-based message
  }
  return new ApiRequestError(message, response.status);
}

/** Map a thrown fetch/abort into a friendly Error; already-built errors
 *  (ApiRequestError, the ones thrown above) pass through unchanged. */
function toRequestError(error: unknown, aborted: boolean): unknown {
  if (aborted) {
    return new Error("The server is taking too long to respond. Check your connection and try again.");
  }
  // A thrown fetch (a TypeError) means the request never reached the server —
  // tell "you're offline" apart from "the server is unreachable". A non-ok HTTP
  // response is a plain Error (thrown above) and keeps the API's own message.
  if (error instanceof TypeError) {
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    return new Error(
      offline
        ? "You appear to be offline. Check your connection and try again."
        : "Can't reach the server right now. Please try again in a moment.",
    );
  }
  return error;
}

async function requestWithToken<T>(
  config: ActionConfig,
  method: ApiMethod,
  path: string,
  body: Record<string, unknown> | undefined,
  token: string,
  isRetry: boolean,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${config.apiBaseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      cache: "no-store",
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    // Expired token → refresh from the live session once, then retry.
    if (response.status === 401 && !isRetry) {
      clearTimeout(timeout);
      return await retryWithFreshToken<T>(config, method, path, body);
    }

    if (!response.ok) throw await toApiError(response);

    const payload = (await response.json()) as ApiSuccess<T>;
    return payload.data;
  } catch (error) {
    throw toRequestError(error, controller.signal.aborted);
  } finally {
    clearTimeout(timeout);
  }
}

/** Convenience for the common GET case. */
export function apiGet<T>(config: ActionConfig, path: string): Promise<T> {
  return apiRequest<T>(config, "GET", path);
}

/** Read `err.message` from a thrown value, with a fallback. */
export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
