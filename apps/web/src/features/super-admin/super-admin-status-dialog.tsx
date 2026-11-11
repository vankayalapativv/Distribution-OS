"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { errorMessage, type ActionConfig } from "@/lib/api-client";
import type { SuperAdminSetupUser } from "./super-admin-types";
import { saveSuperAdminUser } from "./super-admin-save-user";

/** Confirm + apply an Activate / Deactivate on a user. Resends the current
 *  identity fields with the flipped status (the API sets, not coalesces). */
export function StatusDialog({
  user,
  actionConfig,
  onClose,
  onUpdated,
}: {
  readonly user: SuperAdminSetupUser | null;
  readonly actionConfig: ActionConfig;
  readonly onClose: () => void;
  readonly onUpdated: (user: SuperAdminSetupUser) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const active = user.status === "active";
  const nextStatus = active ? "inactive" : "active";
  const verb = active ? "Deactivate" : "Activate";

  async function apply() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await saveSuperAdminUser(
        user,
        { name: user.name, email: user.email, phone: user.phone, status: nextStatus },
        actionConfig,
      );
      onUpdated({ ...user, ...saved });
      onClose();
    } catch (err) {
      setError(errorMessage(err, `Could not ${verb.toLowerCase()} the user.`));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>
            {verb} {user.name}?
          </DialogTitle>
          <DialogDescription>
            {active
              ? "They won't be able to log in and will drop out of assignment lists. Their past records stay intact."
              : "They'll be able to log in again and reappear in assignment lists."}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={active ? "destructive" : "default"}
            onClick={apply}
            disabled={busy}
          >
            {busy ? `${verb.slice(0, -1)}ing…` : verb}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
