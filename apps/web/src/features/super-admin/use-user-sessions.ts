"use client";

import { useEffect, useState } from "react";
import type { AdminSession } from "./super-admin-device-label";

/**
 * Loads a Neon-Auth-linked user's active sessions and revokes them (one or all).
 * The credential token stays server-side; sessions are addressed by opaque id.
 * Revoking the admin's OWN current session bounces the tab to /api/auth/logout.
 */
export function useUserSessions(appLoginId: string) {
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/sessions?appLoginId=${encodeURIComponent(appLoginId)}`);
        const json = (await res.json()) as { sessions?: AdminSession[]; error?: string };
        if (!res.ok) throw new Error(json.error ?? "Could not load sessions.");
        if (!cancelled) setSessions(json.sessions ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load sessions.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [appLoginId]);

  async function revoke(sessionId: string | null) {
    if (sessionId) setRevokingId(sessionId);
    else setRevokingAll(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/sessions", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sessionId ? { appLoginId, sessionId } : { appLoginId }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not sign out.");
      // If this revoke killed the admin's OWN current session (one device or
      // "sign out all"), bounce them to /login immediately — their tab is now
      // unauthenticated. /api/auth/logout clears the cookie and redirects.
      const killedCurrent = sessionId
        ? sessions.find((s) => s.id === sessionId)?.current
        : sessions.some((s) => s.current);
      if (killedCurrent) {
        window.location.href = "/api/auth/logout";
        return;
      }
      setSessions((prev) => (sessionId ? prev.filter((s) => s.id !== sessionId) : []));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign out.");
    } finally {
      setRevokingId(null);
      setRevokingAll(false);
    }
  }

  return { sessions, loading, error, revokingId, revokingAll, revoke };
}
