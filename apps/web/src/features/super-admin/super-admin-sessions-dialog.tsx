"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest, type ActionConfig } from "@/lib/api-client";
import type { SuperAdminSetupUser } from "./super-admin-types";
import { UserSessionsSection } from "./super-admin-user-sessions";

/**
 * Standalone "Manage sessions" dialog opened from the Users kebab. Lists and
 * revokes a user's active devices. Only Neon-Auth-linked accounts have sessions;
 * a local-password user shows an empty state instead. Looks up the user's latest
 * known mobile device (tracking heartbeats) to label their app sessions.
 */
export function SessionsDialog({
  user,
  actionConfig,
  onClose,
}: {
  readonly user: SuperAdminSetupUser | null;
  readonly actionConfig: ActionConfig;
  readonly onClose: () => void;
}) {
  const [deviceModel, setDeviceModel] = useState<string | null>(null);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setDeviceModel(null);
    apiRequest<{ device: { label?: string } | null }>(actionConfig, "GET", `/super-admin/users/${userId}/device`)
      .then((r) => {
        if (!cancelled) setDeviceModel(r.device?.label ?? null);
      })
      .catch(() => {
        /* best-effort — fall back to the generic "Mobile app" label */
      });
    return () => {
      cancelled = true;
    };
  }, [userId, actionConfig]);

  if (!user) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Manage sessions</DialogTitle>
          <DialogDescription>
            Active sign-ins for {user.name}. Sign a device out to force a fresh login there.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {user.appLoginId ? (
            <UserSessionsSection appLoginId={user.appLoginId} deviceModel={deviceModel} />
          ) : (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">
              No active sessions — this user signs in with a local password, not a managed
              login.
            </p>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
