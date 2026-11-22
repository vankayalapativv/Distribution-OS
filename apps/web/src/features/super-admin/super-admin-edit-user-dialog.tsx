"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type ActionConfig } from "@/lib/api-client";
import type { SuperAdminSetupUser } from "./super-admin-types";
import { EditUserFields } from "./super-admin-edit-user-fields";
import { useEditUserForm } from "./use-edit-user-form";

/**
 * Edit a user's identity and login status (SUPER_ADMIN only). Role is not
 * editable here — changing what someone can do is a separate decision.
 */
export function EditUserDialog({
  user,
  onClose,
  onSaved,
  actionConfig,
}: {
  readonly user: SuperAdminSetupUser | null;
  readonly onClose: () => void;
  readonly onSaved: (user: SuperAdminSetupUser) => void;
  readonly actionConfig: ActionConfig;
}) {
  const f = useEditUserForm(user, onSaved, onClose, actionConfig);

  if (!user) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <form onSubmit={(e) => f.handleSubmit(e, user)} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>Update identity and login status. Role isn&apos;t editable here.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <EditUserFields
              name={f.name}
              setName={f.setName}
              email={f.email}
              setEmail={f.setEmail}
              phone={f.phone}
              setPhone={f.setPhone}
              status={f.status}
              setStatus={f.setStatus}
              error={f.error}
            />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={f.busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={!f.name.trim() || f.busy}>
              {f.busy ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
