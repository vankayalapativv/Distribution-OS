"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** One active session, as returned by the BFF (token stripped server-side). */
interface AdminSession {
  id: string;
  createdAt: string | null;
  expiresAt: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  /** True for the admin's OWN current session (set by the BFF). */
  current?: boolean;
}

// Ordered match rules — first hit wins (specific engines before the families
// that also appear in their UA strings, e.g. Edge/Opera before Chrome).
const BROWSER_RULES: [RegExp, string][] = [
  [/Edg\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/Chrome\//, "Chrome"],
  [/Firefox\//, "Firefox"],
  [/Safari\//, "Safari"],
];
const OS_RULES: [RegExp, string][] = [
  [/Windows/, "Windows"],
  [/iPhone|iPad|iOS/, "iOS"],
  [/Android/, "Android"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux/, "Linux"],
];
const matchLabel = (ua: string, rules: [RegExp, string][], fallback: string): string => {
  for (const [re, label] of rules) if (re.test(ua)) return label;
  return fallback;
};

/** Best-effort device label from a raw user-agent string. Our own clients
 *  report a client library rather than a browser UA: a web login's session is
 *  minted server-side (node/undici) — the login route forwards the browser UA so
 *  new web sessions read as "Chrome on Windows" etc. The Expo app sends a custom
 *  device string on sign-in (`DistributionOS/1.1.2 (Android 13; samsung;
 *  SM-G991B)`), forwarded by the API as the session user-agent, so a phone
 *  session reads as its real model ("Samsung SM-G991B"). Older app builds that
 *  predate that send still arrive as OkHttp → generic "Mobile app (Android)". */
export function describeDevice(ua: string | null): string {
  if (!ua) return "Unknown device";
  const sa = /DistributionOS\/\S+ \(Android [^;]+; ([^;]+); ([^)]+)\)/.exec(ua);
  if (sa) {
    const manufacturer = sa[1].trim();
    const model = sa[2].trim();
    const brand =
      manufacturer && manufacturer.toLowerCase() !== "unknown"
        ? manufacturer.charAt(0).toUpperCase() + manufacturer.slice(1)
        : "";
    const name = brand && !model.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${model}` : model;
    return name || "Mobile app (Android)";
  }
  if (/okhttp/i.test(ua)) return "Mobile app (Android)";
  if (/^node(\s|\/|$)/i.test(ua) || /undici/i.test(ua)) return "Web app";
  const browser = matchLabel(ua, BROWSER_RULES, "Browser");
  const os = matchLabel(ua, OS_RULES, "");
  return os ? `${browser} on ${os}` : browser;
}

function fmt(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
}

/**
 * Active-session management for a Neon-Auth-linked user (SUPER_ADMIN only).
 * Lists the user's devices and lets the admin sign out one or all of them —
 * the credential token stays server-side; sessions are addressed by opaque id.
 * Rendered inside the Edit User form, so every control is type="button".
 */
/** Enrich the mobile-app label with the user's known device model when we have
 *  it (from tracking heartbeats), e.g. "Mobile app · Samsung SM-G991B". */
export function sessionLabel(userAgent: string | null, deviceModel: string | null): string {
  if (deviceModel && userAgent && /okhttp/i.test(userAgent)) {
    return `Mobile app · ${deviceModel}`;
  }
  return describeDevice(userAgent);
}

export function UserSessionsSection({
  appLoginId,
  deviceModel = null,
}: {
  readonly appLoginId: string;
  readonly deviceModel?: string | null;
}) {
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

  return (
    <div className="space-y-2 border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Active sessions
        </p>
        {sessions.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void revoke(null)}
            disabled={revokingAll || revokingId !== null}
          >
            {revokingAll ? "Signing out…" : "Sign out all"}
          </Button>
        ) : null}
      </div>

      {(() => { if (loading) return (
        <div className="divide-y divide-border rounded-md border border-border">
          {Array.from({ length: 2 }).map((_, i) => (
            <div className="flex items-center gap-3 px-3 py-2.5" key={i}>
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          ))}
        </div>
      ); if (error) return (
        <p className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ); if (sessions.length === 0) return (
        <p className="rounded-md border border-dashed border-border px-4 py-4 text-center text-sm text-muted-foreground">
          No active sessions — this user is signed out everywhere.
        </p>
      ); return (
        <div className="divide-y divide-border rounded-md border border-border">
          {sessions.map((s) => (
            <div className="flex items-center gap-3 px-3 py-2.5" key={s.id}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-card-foreground">
                  {sessionLabel(s.userAgent, deviceModel)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {[s.ipAddress, s.createdAt ? `signed in ${fmt(s.createdAt)}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => void revoke(s.id)}
                disabled={revokingId === s.id || revokingAll}
              >
                {revokingId === s.id ? "Signing out…" : "Sign out"}
              </Button>
            </div>
          ))}
        </div>
      ); })()}
    </div>
  );
}
