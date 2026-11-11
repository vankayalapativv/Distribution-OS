import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Single entry point for every server-side call to the Sri Aparajita API.
 *
 * On Cloudflare (deployed) it uses the `API` **service binding** — a public
 * fetch to the API's `*.workers.dev` URL fails with Cloudflare error 1042
 * (a Worker cannot fetch another Worker on the same account over workers.dev).
 * Locally (`next dev`) the binding isn't present, so it falls back to a
 * public fetch against `SRI_APARAJITA_API_BASE_URL` (or the localhost dev ports).
 *
 * `path` is the API path WITHOUT the version prefix, e.g. "/auth/login",
 * "/customers", "/me".
 *
 * Resilience (fix #3): each attempt has a timeout so a cold start or hung DB
 * can't freeze the render, and a transient failure (thrown fetch or 5xx) on an
 * **idempotent** read is retried a couple of times with a short backoff — so a
 * one-off Neon blip rides through instead of throwing the user to `error.tsx`.
 * Writes (POST/PUT/PATCH/DELETE) are never retried, so nothing is repeated.
 */
interface Fetcher {
  fetch(input: Request): Promise<Response>;
}

/** Per-attempt ceiling — generous enough for a genuine Neon/Worker cold start. */
const ATTEMPT_TIMEOUT_MS = 10_000;
/** Backoff before each retry; length = number of retries (so 3 attempts total). */
const RETRY_BACKOFF_MS = [150, 500];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isIdempotent(init?: RequestInit): boolean {
  const method = (init?.method ?? "GET").toUpperCase();
  return method === "GET" || method === "HEAD";
}

/** One request attempt: service binding when deployed, public fetch in dev. */
async function fetchOnce(path: string, init: RequestInit): Promise<Response> {
  // Service binding (deployed on Cloudflare).
  try {
    const { env } = await getCloudflareContext({ async: true });
    const api = (env as unknown as { API?: Fetcher }).API;
    if (api) {
      // The host is irrelevant for a service binding — only the path matters.
      // The API worker serves its routes under /api/v1.
      return await api.fetch(new Request(`https://api/api/v1${path}`, init));
    }
  } catch {
    // Not running on Cloudflare (local dev) — fall through to public fetch.
  }

  // Local dev: public fetch, trying the configured base or the dev ports.
  const bases = process.env.SRI_APARAJITA_API_BASE_URL
    ? [process.env.SRI_APARAJITA_API_BASE_URL]
    : [
        "http://localhost:8787/api/v1",
        "http://localhost:8788/api/v1",
        "http://localhost:8789/api/v1",
      ];

  let lastError: unknown;
  for (const base of bases) {
    try {
      const response = await fetch(`${base}${path}`, init);
      if (response.ok || process.env.SRI_APARAJITA_API_BASE_URL) return response;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("API is unavailable.");
}

type AttemptResult =
  | { ok: true; response: Response }
  | { ok: false; error: unknown; retry: boolean };

/** One fetch attempt with its own timeout; returns the response, or an error
 *  plus whether another attempt should follow. */
async function runAttempt(path: string, init: RequestInit | undefined, retryable: boolean, isLast: boolean): Promise<AttemptResult> {
  // Arm a timeout unless the caller already supplied their own signal.
  const controller = init?.signal ? null : new AbortController();
  const timer = controller ? setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS) : null;
  const attemptInit: RequestInit = controller ? { ...init, signal: controller.signal } : (init ?? {});
  try {
    const response = await fetchOnce(path, attemptInit);
    // A 5xx is a transient server/DB blip — retry it (idempotent reads only).
    if (retryable && response.status >= 500 && !isLast) {
      return { ok: false, error: new Error(`API responded with ${response.status}`), retry: true };
    }
    return { ok: true, response };
  } catch (error) {
    // Thrown fetch (network / timeout abort) — retry if attempts remain.
    return { ok: false, error, retry: !isLast };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function serverApiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  // Only idempotent reads may retry — a repeated write could double-submit.
  const retryable = isIdempotent(init);
  const maxAttempts = retryable ? RETRY_BACKOFF_MS.length + 1 : 1;

  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await runAttempt(path, init, retryable, attempt === maxAttempts - 1);
    if (result.ok) return result.response;
    lastError = result.error;
    if (result.retry) await delay(RETRY_BACKOFF_MS[attempt]);
  }
  throw lastError instanceof Error ? lastError : new Error("API is unavailable.");
}
