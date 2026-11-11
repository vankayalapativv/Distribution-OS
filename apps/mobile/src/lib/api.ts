/**
 * Minimal API client for the Sri Aparajitha Hono API — the request/upload entry points.
 * Base URL, error type, and low-level helpers live in ./api-core.
 *
 * Access tokens are short-lived Neon EdDSA JWTs. Every authenticated request is
 * wrapped by requestWithAuth, which (1) proactively mints a fresh token if the
 * one it was handed is about to expire and (2) on a 401 mints a fresh token from
 * the Neon session and retries once — soft-expiring the session only if that
 * refresh fails (session dead/revoked). See token-refresh.ts.
 */
import {
  API_BASE_URL,
  ApiRequestError,
  type ApiEnvelope,
  handleSessionHeaders,
  parseJsonEnvelope,
  REQUEST_TIMEOUT_MS,
  reportServerError,
} from "./api-core";
import { notifyAuthExpired } from "./auth-events";
import { ensureFreshToken, refreshAccessToken } from "./token-refresh";

/**
 * Send one request with a given token, honouring a per-attempt timeout that
 * stays armed through the body read (a stalled body must not hang forever).
 */
async function attempt<T>(
  path: string,
  buildInit: (token: string | null) => RequestInit,
  token: string | null,
  timeoutMs: number,
): Promise<{ res: Response; payload: ApiEnvelope<T> }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...buildInit(token),
      signal: controller.signal,
    });
    const payload = await parseJsonEnvelope<T>(res);
    return { res, payload };
  } finally {
    clearTimeout(timeout);
  }
}

type Attempt<T> = { res: Response; payload: ApiEnvelope<T> };

/** Reactive 401 handling: an authenticated request that 401s gets ONE
 *  mint-and-retry, then soft-expires (or fails soft when Neon is unreachable,
 *  which is what stops the "auto-logout on 4G" reports). */
async function retryOn401<T>(
  path: string,
  buildInit: (token: string | null) => RequestInit,
  effective: string | null,
  timeoutMs: number,
  token: string | null,
  current: Attempt<T>,
): Promise<Attempt<T>> {
  if (!(current.res.status === 401 && token)) return current;
  const r = await refreshAccessToken();
  let next = current;
  if (r.status === "active" && r.token !== effective) {
    next = await attempt<T>(path, buildInit, r.token, timeoutMs);
  }
  if (next.res.status === 401) {
    // Only log out on a DEFINITIVE answer (revoked / freshly-minted token still
    // 401s). If we simply couldn't reach Neon, keep the session and fail soft.
    if (r.status === "unavailable") {
      throw new ApiRequestError("OFFLINE", "No connection — please try again.", 0);
    }
    notifyAuthExpired();
  }
  return next;
}

function toApiError(payload: ApiEnvelope<unknown>, res: Response, failVerb: string): ApiRequestError {
  return new ApiRequestError(
    payload.error?.code ?? "UNKNOWN",
    payload.error?.message ?? `${failVerb} failed with status ${res.status}.`,
    res.status,
    payload.error?.details,
  );
}

/**
 * Core of both apiFetch and apiUpload: proactive refresh → send → on 401,
 * reactive mint-and-retry-once → soft-expire if still unauthorized.
 */
async function requestWithAuth<T>(
  path: string,
  buildInit: (token: string | null) => RequestInit,
  token: string | null,
  timeoutMs: number,
  failVerb: string,
): Promise<T> {
  try {
    // Proactive: swap in a fresh token before we even send if this one is stale.
    const effective = token ? await ensureFreshToken(token) : token;
    const first = await attempt<T>(path, buildInit, effective, timeoutMs);
    const { res, payload } = await retryOn401<T>(path, buildInit, effective, timeoutMs, token, first);

    handleSessionHeaders(res);
    if (!res.ok || !payload.success) throw toApiError(payload, res, failVerb);
    return payload.data;
  } catch (e) {
    if (e instanceof ApiRequestError && e.status >= 500) reportServerError(path, e.status, e.message);
    throw e;
  }
}

export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  return requestWithAuth<T>(
    path,
    (token) => {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      return {
        method: options.method ?? "GET",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      };
    },
    options.token ?? null,
    REQUEST_TIMEOUT_MS,
    "Request",
  );
}

/** Multipart upload variant (photos). Body must be a FormData instance. */
export async function apiUpload<T>(
  path: string,
  form: FormData,
  token: string | null,
): Promise<T> {
  return requestWithAuth<T>(
    path,
    (tok) => {
      const headers: Record<string, string> = {};
      if (tok) headers.Authorization = `Bearer ${tok}`;
      // no Content-Type: fetch sets the multipart boundary itself
      return { method: "POST", headers, body: form };
    },
    token,
    // Uploads carry photos — allow longer than plain API calls before aborting.
    60_000,
    "Upload",
  );
}

// Re-exported so importers keep using "./api" for the error type and the base
// URL (authenticated image sources).
export { API_BASE_URL, ApiRequestError };
