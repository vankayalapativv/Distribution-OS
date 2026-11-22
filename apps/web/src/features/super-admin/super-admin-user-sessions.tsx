"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fmt, sessionLabel } from "./super-admin-device-label";
import { useUserSessions } from "./use-user-sessions";

// Re-exported so existing importers of these pure helpers keep working.
export { describeDevice, fmt, sessionLabel } from "./super-admin-device-label";

function SkeletonRows() {
  return (
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
  );
}

/**
 * Active-session management for a Neon-Auth-linked user (SUPER_ADMIN only).
 * Rendered inside the Edit User form, so every control is type="button".
 */
export function UserSessionsSection({
  appLoginId,
  deviceModel = null,
}: {
  readonly appLoginId: string;
  readonly deviceModel?: string | null;
}) {
  const { sessions, loading, error, revokingId, revokingAll, revoke } = useUserSessions(appLoginId);

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

      {(() => { if (loading) return <SkeletonRows />;
        if (error) return (
          <p className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        );
        if (sessions.length === 0) return (
          <p className="rounded-md border border-dashed border-border px-4 py-4 text-center text-sm text-muted-foreground">
            No active sessions — this user is signed out everywhere.
          </p>
        );
        return (
          <div className="divide-y divide-border rounded-md border border-border">
            {sessions.map((s) => (
              <div className="flex items-center gap-3 px-3 py-2.5" key={s.id}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-card-foreground">
                    {sessionLabel(s.userAgent, deviceModel)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[s.ipAddress, s.createdAt ? `signed in ${fmt(s.createdAt)}` : null].filter(Boolean).join(" · ")}
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
        );
      })()}
    </div>
  );
}
