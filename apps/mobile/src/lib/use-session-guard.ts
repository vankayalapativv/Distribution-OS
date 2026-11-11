/**
 * Session-revocation guard. A short-lived (~15 min) API JWT stays valid until it
 * expires even after an admin revokes the Neon session, so on its own a revoked
 * field user keeps working until their current token ages out. This hook closes
 * that gap: while signed in, it re-probes the Neon session on every app→
 * foreground return and on a slow idle tick, and logs the user out the moment
 * Neon says the session is gone.
 *
 * Offline-safe by design: it acts ONLY on a DEFINITIVE "revoked" answer (a 401/
 * 403 from Neon). A network outage (field dead zone) is "unavailable" and is
 * ignored — a signal-less field worker must never be logged out. When the probe
 * succeeds it also adopts the fresh token, keeping the session from aging out.
 */
import { useEffect } from "react";
import { AppState } from "react-native";
import { useAuth } from "./auth";
import { SESSION_KEY, storage } from "./auth-storage";
import { neonProbeSession } from "./neon-auth";

// ~2 min idle cadence (foreground returns catch the common case sooner).
const IDLE_INTERVAL_MS = 120_000;

export function useSessionGuard(): void {
  const hasToken = useAuth((s) => s.token != null);

  useEffect(() => {
    if (!hasToken) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let running = false;

    async function runCheck() {
      if (cancelled || running) return;
      // A logout between scheduling and running clears the token — bail so we
      // never probe (or worse, resurrect) a signed-out session.
      if (useAuth.getState().token == null) return;
      running = true;
      try {
        const session = await storage.get(SESSION_KEY);
        if (cancelled) return;
        if (!session) return; // nothing to probe (shouldn't happen while signed in)

        const { status, token } = await neonProbeSession(session);
        if (cancelled || useAuth.getState().token == null) return;

        if (status === "revoked") {
          // Definitive: the session was revoked (handover / off-boarding).
          await useAuth.getState().expireSession();
        } else if (status === "active" && token) {
          // Keep the API token fresh so requests rarely hit an expiry 401.
          await useAuth.getState().applyRefreshedToken(token);
        }
        // "unavailable" → inconclusive (offline); leave the session untouched.
      } catch {
        // Never flip auth state on an unexpected error — treat as inconclusive.
      } finally {
        running = false;
        if (!cancelled) {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => void runCheck(), IDLE_INTERVAL_MS);
        }
      }
    }

    void runCheck();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void runCheck();
    });
    return () => {
      cancelled = true;
      sub.remove();
      if (timer) clearTimeout(timer);
    };
  }, [hasToken]);
}
