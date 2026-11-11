/**
 * Shared internals for the Sri Aparajitha Hono API client (base URL, error type,
 * session-header side effects, envelope parsing). Split out of api.ts so that
 * module stays small; apiFetch / apiUpload live there and import these.
 *
 * Base URL comes from EXPO_PUBLIC_API_URL (set in .env / eas.json per
 * environment). The default targets the local Workers dev server — on a
 * physical device replace localhost with your machine's LAN IP.
 */
import { notifyTokenRefreshed } from "./auth-events";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787/api/v1";

// A stalled connection must fail fast so screens fall back to the SQLite
// cache instead of showing skeletons forever (fetch has no default timeout).
export const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Adopt a legacy server-slid token if one is present (X-Refresh-Token). The
 * Neon-authenticated API no longer emits this — access tokens are refreshed
 * client-side from the Neon session (see token-refresh.ts) — but keeping the
 * hook is harmless and covers any endpoint still returning it during cutover.
 * The 401 handling now lives in the API client, which first tries a refresh.
 */
export function handleSessionHeaders(res: Response): void {
  const refreshed = res.headers.get("X-Refresh-Token");
  if (refreshed) notifyTokenRefreshed(refreshed);
}

export class ApiRequestError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    /** Optional structured payload the server attached to the error (e.g. the
     *  open visit's customerId for OPEN_VISIT, so the UI can navigate there). */
    public details?: unknown,
  ) {
    super(message);
  }
}

/**
 * Surface a systemic server failure (5xx / non-JSON edge page) to the in-house
 * error monitor. Dynamically imported so report-error (which imports from here)
 * doesn't create a static cycle. Client 4xx and offline network/timeout errors
 * are expected and caller-handled, so they are deliberately never reported here.
 */
export function reportServerError(path: string, status: number, message: string): void {
  void import("./report-error")
    .then((m) =>
      m.reportMobileError(new Error(`API ${status} ${path}: ${message}`), {
        boundary: "api",
        kind: "ApiServerError",
        route: path,
      }),
    )
    .catch(() => undefined);
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string; details?: unknown };
}

/**
 * Parse a response as our JSON envelope, turning a non-JSON body (Cloudflare
 * edge HTML on 502/503/1015, a proxy login page, etc.) into a clean
 * ApiRequestError instead of letting `res.json()` throw a cryptic SyntaxError.
 */
export async function parseJsonEnvelope<T>(res: Response): Promise<ApiEnvelope<T>> {
  try {
    return (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiRequestError(
      "NON_JSON_RESPONSE",
      `Request failed with status ${res.status}.`,
      res.status,
    );
  }
}
