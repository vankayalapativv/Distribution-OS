"use client";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CredentialsPanel, SuperAdminConfirmPanel } from "./super-admin-add-user-panels";
import { AddUserForm } from "./super-admin-add-user-form";
import { useAddUser } from "./use-add-user";
import type { SuperAdminActionConfig, SuperAdminSetupUser } from "./super-admin-types";

interface AddUserDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly actionConfig: SuperAdminActionConfig;
  readonly onUserCreated: (user: SuperAdminSetupUser) => void;
}

export function AddUserDialog({ open, onOpenChange, onUserCreated }: AddUserDialogProps) {
  const a = useAddUser(onUserCreated);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onOpenChange(false); }}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{a.createdCredentials ? "Credentials created" : "Add user"}</DialogTitle>
          <DialogDescription>
            {(() => {
              if (a.createdCredentials) return "Share these login details securely — the password can't be shown again.";
              if (a.pendingSuperAdmin) return "Confirm creating a full-access account.";
              return "Create a login for a team member.";
            })()}
          </DialogDescription>
        </DialogHeader>

        {(() => { if (a.createdCredentials) return (
          <DialogBody className="space-y-4">
            <CredentialsPanel
              credentials={a.createdCredentials}
              copied={a.copied}
              onCopy={a.copyCredentials}
              onDone={() => onOpenChange(false)}
            />
          </DialogBody>
        ); if (a.pendingSuperAdmin) return (
          <DialogBody className="space-y-4">
            <SuperAdminConfirmPanel
              payload={a.pendingSuperAdmin}
              isCreating={a.isCreatingUser}
              error={a.userFormError}
              onConfirm={() => void a.submitUser(a.pendingSuperAdmin!)}
              onBack={() => a.setPendingSuperAdmin(null)}
            />
          </DialogBody>
        ); return (
          <AddUserForm
            role={a.userRole}
            setRole={a.setUserRole}
            name={a.userName}
            setName={a.setUserName}
            phone={a.userPhone}
            setPhone={a.setUserPhone}
            email={a.userEmail}
            setEmail={a.setUserEmail}
            error={a.userFormError}
            busy={a.isCreatingUser}
            onSubmit={a.handleCreateUser}
            onCancel={() => onOpenChange(false)}
          />
        ); })()}
      </DialogContent>
    </Dialog>
  );
}
