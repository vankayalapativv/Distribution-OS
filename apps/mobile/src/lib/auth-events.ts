/**
 * Decouples the low-level API client from the auth store. `apiFetch` emits two
 * events; the auth store (which imports the client) registers the handlers.
 * Keeping the wiring here means `api.ts` never imports `auth.ts` — no cycle.
 *
 *  - token-refreshed: a response carried an X-Refresh-Token (the server slid the
 *    session forward). The handler persists it so the token never ages out.
 *  - auth-expired: a token-bearing request still got a 401 — the token is truly
 *    dead (user away > 7 days). The handler drops the session so the app routes
 *    to login, WITHOUT wiping the offline queue (it flushes after re-login).
 */
type RefreshHandler = (token: string) => void;
type ExpiredHandler = () => void;

let onRefresh: RefreshHandler | null = null;
let onExpired: ExpiredHandler | null = null;

export function setAuthEventHandlers(handlers: {
  onRefresh?: RefreshHandler;
  onExpired?: ExpiredHandler;
}): void {
  if (handlers.onRefresh) onRefresh = handlers.onRefresh;
  if (handlers.onExpired) onExpired = handlers.onExpired;
}

export function notifyTokenRefreshed(token: string): void {
  onRefresh?.(token);
}

// Debounced: a burst of concurrent 401s (many queued writes flushing at once)
// must trigger exactly one soft logout, not a storm.
let lastExpiredAt = 0;
export function notifyAuthExpired(): void {
  const now = Date.now();
  if (now - lastExpiredAt < 3000) return;
  lastExpiredAt = now;
  onExpired?.();
}
